"use client";

import { startTransition, useEffect, useRef, useState, type FormEvent } from "react";

type Task = {
  id: number;
  title: string;
  dueTime: string;
  detail: string;
  completed: boolean;
  completedBy?: string;
};

type SortMode = "time" | "name";

const taskStorageKey = "minna-check:tasks";

function isStoredTask(value: unknown): value is Task {
  if (typeof value !== "object" || value === null) return false;

  const task = value as Partial<Task>;
  return (
    typeof task.id === "number" &&
    typeof task.title === "string" &&
    typeof task.dueTime === "string" &&
    typeof task.detail === "string" &&
    typeof task.completed === "boolean" &&
    (task.completedBy === undefined || typeof task.completedBy === "string")
  );
}

const initialTasks: Task[] = [
  { id: 1, title: "朝ごはんを用意する", dueTime: "07:30", detail: "", completed: true, completedBy: "まい" },
  { id: 2, title: "子どもの水筒を入れる", dueTime: "07:45", detail: "出発前まで", completed: false },
  { id: 3, title: "ゴミを出す", dueTime: "08:00", detail: "", completed: false },
  { id: 4, title: "戸締まりを確認する", dueTime: "08:15", detail: "最後に出る人", completed: false },
];

export default function Home() {
  const [tasks, setTasks] = useState(initialTasks);
  const [isTaskStorageReady, setIsTaskStorageReady] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isDeletingTasks, setIsDeletingTasks] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("time");
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  const [animatingTaskId, setAnimatingTaskId] = useState<number | null>(null);
  const [isCompletionDialogOpen, setIsCompletionDialogOpen] = useState(false);
  const completionDialogRef = useRef<HTMLDialogElement>(null);
  const completedCount = tasks.filter((task) => task.completed).length;
  const progress = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);
  const sortedTasks = [...tasks].sort((firstTask, secondTask) => {
    const completionOrder = Number(firstTask.completed) - Number(secondTask.completed);
    if (completionOrder !== 0) return completionOrder;

    if (sortMode === "name") {
      return firstTask.title.localeCompare(secondTask.title, "ja");
    }

    return firstTask.dueTime.localeCompare(secondTask.dueTime);
  });

  useEffect(() => {
    const dialog = completionDialogRef.current;
    if (!dialog) return;

    if (isCompletionDialogOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isCompletionDialogOpen && dialog.open) {
      dialog.close();
    }
  }, [isCompletionDialogOpen]);

  useEffect(() => {
    try {
      const savedTasks = window.localStorage.getItem(taskStorageKey);
      if (savedTasks) {
        const parsedTasks: unknown = JSON.parse(savedTasks);
        if (Array.isArray(parsedTasks)) {
          startTransition(() => setTasks(parsedTasks.filter(isStoredTask)));
        }
      }
    } catch {
      return;
    } finally {
      setIsTaskStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isTaskStorageReady) return;

    try {
      window.localStorage.setItem(taskStorageKey, JSON.stringify(tasks));
    } catch {
      return;
    }
  }, [isTaskStorageReady, tasks]);

  function completeTask(id: number) {
    const updatedTasks = tasks.map((task) =>
      task.id === id ? { ...task, completed: true, completedBy: "あなた" } : task,
    );
    setTasks(updatedTasks);
    setAnimatingTaskId(null);

    if (updatedTasks.length > 0 && updatedTasks.every((task) => task.completed)) {
      setIsCompletionDialogOpen(true);
    }
  }

  function startTaskCompletion(id: number) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      completeTask(id);
      return;
    }

    setAnimatingTaskId(id);
  }

  function resetTask(id: number) {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === id ? { ...task, completed: false, completedBy: undefined } : task,
      ),
    );
  }

  function toggleTaskSelection(id: number) {
    setSelectedTaskIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(id)) {
        nextIds.delete(id);
      } else {
        nextIds.add(id);
      }
      return nextIds;
    });
  }

  function deleteSelectedTasks() {
    if (selectedTaskIds.size === 0) return;
    if (!window.confirm(`選択した${selectedTaskIds.size}件のタスクを削除しますか？`)) return;

    setTasks((currentTasks) => currentTasks.filter((task) => !selectedTaskIds.has(task.id)));
    setSelectedTaskIds(new Set());
    setIsDeletingTasks(false);
  }

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") ?? "").trim();
    const dueTime = String(formData.get("dueTime") ?? "");
    const detail = String(formData.get("detail") ?? "").trim();

    if (!title || !dueTime) return;

    setTasks((currentTasks) => [
      ...currentTasks,
      {
        id: currentTasks.reduce((highestId, task) => Math.max(highestId, task.id), 0) + 1,
        title,
        dueTime,
        detail,
        completed: false,
      },
    ]);
    setIsAddingTask(false);
  }

  function closeDeleteMode() {
    setSelectedTaskIds(new Set());
    setIsDeletingTasks(false);
  }

  return (
    <main className="app-shell">
      <section className="board-section" aria-labelledby="board-title">
        <header className="board-heading">
          <div className="board-heading-row">
            <h1 id="board-title">今日のタスク</h1>
            <p className="progress-summary" aria-live="polite">
              <strong>{completedCount}</strong> / {tasks.length} 完了
            </p>
          </div>
          <div
            aria-label={`タスクの進捗: ${completedCount} / ${tasks.length} 完了`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress}
            className="progress-track"
            role="progressbar"
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="board-controls">
            <label className="sort-control">
              <span>並び順</span>
              <select
                aria-label="タスクの並び順"
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
              >
                <option value="time">時間順</option>
                <option value="name">あいうえお順</option>
              </select>
            </label>
            <button
              className="add-task-button"
              type="button"
              onClick={() => {
                closeDeleteMode();
                setIsAddingTask(true);
              }}
            >
              + タスクを追加
            </button>
            {isDeletingTasks ? (
              <>
                <button
                  className="cancel-button"
                  type="button"
                  onClick={closeDeleteMode}
                >
                  キャンセル
                </button>
                <button
                  className="delete-button"
                  type="button"
                  disabled={selectedTaskIds.size === 0}
                  onClick={deleteSelectedTasks}
                >
                  選択したタスクを削除 ({selectedTaskIds.size})
                </button>
              </>
            ) : (
              <button
                className="delete-button"
                type="button"
                onClick={() => {
                  setIsAddingTask(false);
                  setIsDeletingTasks(true);
                }}
              >
                削除
              </button>
            )}
          </div>
        </header>
        {isAddingTask && (
          <form className="add-task-form" onSubmit={addTask}>
            <div className="add-task-fields">
              <input
                aria-label="新しいタスク名"
                autoFocus
                maxLength={60}
                name="title"
                placeholder="タスク名"
                required
              />
              <label className="deadline-field">
                期限時刻 <span>必須</span>
                <input
                  aria-label="期限時刻（必須）"
                  name="dueTime"
                  required
                  type="time"
                />
              </label>
              <input
                aria-label="期限や補足"
                maxLength={80}
                name="detail"
                placeholder="補足（例: 出発前まで）"
              />
            </div>
            <div className="add-task-actions">
              <button className="complete-button" type="submit">追加</button>
              <button
                className="cancel-button"
                type="button"
                onClick={() => setIsAddingTask(false)}
              >
                キャンセル
              </button>
            </div>
          </form>
        )}
        <div className="task-list">
          {sortedTasks.map((task) => (
            <article className={`task-card ${task.completed ? "is-complete" : ""}`} key={task.id}>
              <div className="task-content">
                <div className="task-title-row">
                  <h3>{task.title}</h3>
                  <span className="deadline-tag">{task.dueTime}</span>
                  {task.completed ? <span className="done-tag">完了</span> : <span className="waiting-tag">まだ</span>}
                </div>
                {(task.completed || task.detail) && (
                  <p>{task.completed ? `${task.completedBy}が完了しました` : task.detail}</p>
                )}
              </div>
              <div className="task-actions">
                {isDeletingTasks ? (
                  <input
                    aria-label={`${task.title}を削除対象に選択`}
                    checked={selectedTaskIds.has(task.id)}
                    className="task-select-checkbox"
                    type="checkbox"
                    onChange={() => toggleTaskSelection(task.id)}
                  />
                ) : task.completed ? (
                  <button
                    aria-label={`${task.title}を未完了に戻す`}
                    className="reset-button"
                    type="button"
                    onClick={() => resetTask(task.id)}
                  >
                    取り消す
                  </button>
                ) : (
                  <button
                    className={`complete-button ${animatingTaskId === task.id ? "is-completing" : ""}`}
                    disabled={animatingTaskId !== null}
                    type="button"
                    onAnimationEnd={() => completeTask(task.id)}
                    onClick={() => startTaskCompletion(task.id)}
                  >
                    やったよ
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
        <dialog
          aria-labelledby="completion-title"
          className="completion-dialog"
          onClose={() => setIsCompletionDialogOpen(false)}
          ref={completionDialogRef}
        >
          <span aria-hidden="true" className="completion-mark">✓</span>
          <h2 id="completion-title">本日のタスクは全て完了しました</h2>
          <button
            autoFocus
            className="complete-button"
            type="button"
            onClick={() => setIsCompletionDialogOpen(false)}
          >
            閉じる
          </button>
        </dialog>
      </section>
    </main>
  );
}
