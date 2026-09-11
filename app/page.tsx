"use client";

import { useState } from "react";

type Article = {
  id: string;
  url: string;
  title: string;
  body: string;
  date: string | null;
  number: number;
  drawOrder: number;
};

type RouletteResponse = {
  totalCount?: number;
  articles?: Article[];
  error?: string;
};

function formatDate(value: string | null) {
  if (!value) return "日付なし";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(date);
}

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [error, setError] = useState("");

  async function drawArticles() {
    setIsDrawing(true);
    setError("");

    try {
      const response = await fetch("/api/roulette", { cache: "no-store" });
      const data = (await response.json()) as RouletteResponse;
      if (!response.ok || !data.articles || data.totalCount === undefined) {
        throw new Error(data.error ?? "日記を取得できませんでした。");
      }
      setArticles(data.articles);
      setTotalCount(data.totalCount);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "日記を取得できませんでした。",
      );
      setArticles([]);
    } finally {
      setIsDrawing(false);
    }
  }

  return (
    <main className="diary-shell">
      <section className="hero-panel">
        <div className="eyebrow">NOTION DIARY / RANDOM ARCHIVE</div>
        <h1>
          記憶のページを、<em>偶然</em>ひらく。
        </h1>
        <p className="hero-copy">
          あなたの日記データベースから、今日の10ページを選びます。
          <br />
          どの番号が出るかは、その日の小さな運まかせ。
        </p>

        <div className="draw-panel">
          <div>
            <span className="panel-label">ARCHIVE SIZE</span>
            <strong className="archive-count">
              {totalCount === null ? "--" : totalCount.toLocaleString("ja-JP")}
            </strong>
            <span className="panel-caption">pages in your database</span>
          </div>
          <button className="draw-button" onClick={drawArticles} disabled={isDrawing}>
            <span className={`button-mark${isDrawing ? " is-spinning" : ""}`}>
              ↻
            </span>
            {isDrawing ? "ページを探しています" : "ルーレットを回す"}
          </button>
        </div>
      </section>

      <section className="results-section" aria-live="polite">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TODAY&apos;S DRAW</span>
            <h2>{articles.length ? "選ばれた10ページ" : "まだページは選ばれていません"}</h2>
          </div>
          {articles.length > 0 && <span className="result-count">10 / {totalCount} pages</span>}
        </div>

        {error && <p className="error-message">{error}</p>}

        {articles.length > 0 ? (
          <div className="article-grid">
            {articles.map((article) => (
              <article className="article-card" key={article.id}>
                <div className="card-meta">
                  <span className="number-badge">
                    NO. {String(article.number).padStart(4, "0")}
                  </span>
                  <span>{formatDate(article.date)}</span>
                </div>
                <h3>{article.title}</h3>
                <p>{article.body}</p>
                <a href={article.url} target="_blank" rel="noreferrer">
                  Notionで開く <span aria-hidden="true">↗</span>
                </a>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-mark">10</span>
            <p>ボタンを押すと、データベースからランダムに10ページを選びます。</p>
          </div>
        )}
      </section>
    </main>
  );
}
