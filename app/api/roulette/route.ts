type NotionText = {
  plain_text?: string;
  text?: { content?: string };
};

type NotionProperty = {
  title?: NotionText[];
  rich_text?: NotionText[];
  date?: { start?: string | null } | null;
};

type NotionPage = {
  id: string;
  url?: string;
  properties?: Record<string, NotionProperty>;
};

type NotionQueryResponse = {
  results?: NotionPage[];
  has_more?: boolean;
  next_cursor?: string | null;
};

const NOTION_VERSION = "2022-06-28";
const NOTION_API_URL = "https://api.notion.com/v1/databases";

function getText(items: NotionText[] | undefined) {
  return (items ?? [])
    .map((item) => item.plain_text ?? item.text?.content ?? "")
    .join("")
    .trim();
}

function hasDiaryText(page: NotionPage) {
  return Object.values(page.properties ?? {}).some((property) =>
    Boolean(getText(property.rich_text)),
  );
}

function getPageContent(page: NotionPage) {
  const properties = Object.entries(page.properties ?? {});
  const title = properties
    .map(([name, property]) => ({ name, value: getText(property.title) }))
    .find((property) => property.value);
  const richText = properties
    .map(([name, property]) => ({ name, value: getText(property.rich_text) }))
    .filter((property) => property.value);
  const date = properties
    .map(([, property]) => property.date?.start)
    .find((value): value is string => Boolean(value));
  const body = richText
    .filter((property) => property.name !== title?.name)
    .map((property) => property.value)
    .join("\n\n");

  return {
    id: page.id,
    url: page.url ?? `https://www.notion.so/${page.id.replaceAll("-", "")}`,
    title: title?.value || "無題の日記",
    body: body || title?.value || "本文がありません",
    date: date ?? null,
  };
}

async function fetchAllPages(token: string, databaseId: string) {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;

  do {
    const response = await fetch(`${NOTION_API_URL}/${databaseId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
      body: JSON.stringify({
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = await response.text();
      if (response.status === 404) {
        throw new Error(
          "Notionのデータベースが見つかりません。対象DBをこのインテグレーションに共有してください。",
        );
      }
      throw new Error(`Notion API error (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as NotionQueryResponse;
    pages.push(...(data.results ?? []));
    cursor = data.has_more ? data.next_cursor ?? undefined : undefined;
  } while (cursor);

  return pages;
}

function pickRandomPages<T>(items: T[], amount: number) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled.slice(0, amount);
}

function sortByOldest<T extends { date: string | null }>(items: T[]) {
  return [...items].sort((left, right) => {
    if (!left.date && !right.date) return 0;
    if (!left.date) return 1;
    if (!right.date) return -1;
    return new Date(left.date).getTime() - new Date(right.date).getTime();
  });
}

export async function GET() {
  const token = process.env.NOTION_KEY?.trim();
  const databaseId = process.env.DIARY_DATABASE_ID?.trim();

  if (!token || !databaseId) {
    return Response.json(
      { error: "NOTION_KEY と DIARY_DATABASE_ID が設定されていません。" },
      { status: 500 },
    );
  }

  try {
    const pages = await fetchAllPages(token, databaseId);
    const diaryPages = pages.filter(hasDiaryText);
    const articles = sortByOldest(pickRandomPages(diaryPages.map(getPageContent), 10)).map(
      (article, index) => ({
        ...article,
        number: diaryPages.findIndex((page) => page.id === article.id) + 1,
        drawOrder: index + 1,
      }),
    );
    return Response.json({ totalCount: diaryPages.length, articles });
  } catch (error) {
    console.error("Failed to draw diary pages", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Notionから日記を取得できませんでした。設定と接続を確認してください。",
      },
      { status: 502 },
    );
  }
}