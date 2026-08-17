import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { CATEGORY_IMAGES, mockTasks, type Task } from "@/lib/mock-data";

type NewTaskInput = Pick<Task, "title" | "category" | "description" | "budget" | "location" | "author"> & {
  image?: string;
  userId?: string;
  status?: Task["status"];
};

type TasksContextValue = {
  tasks: Task[];
  addTask: (task: NewTaskInput) => Task;
  getTaskById: (id: string) => Task | undefined;
};

const STORAGE_KEY = "zadachanet.tasks.v2";

const TasksContext = createContext<TasksContextValue | undefined>(undefined);

function createTask(input: NewTaskInput): Task {
  const uniquePart =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id: `task-${uniquePart}`,
    title: input.title,
    category: input.category,
    description: input.description,
    budget: input.budget,
    location: input.location,
    author: input.author,
    userId: input.userId,
    status: input.status ?? "active",
    postedAt: "току-що",
    image: input.image ?? CATEGORY_IMAGES[input.category] ?? CATEGORY_IMAGES.drugi,
  };
}

function readStoredTasks(): Task[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredTasks(tasks: Task[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // Ако браузърът блокира localStorage, приложението остава интерактивно чрез React state.
  }
}

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);

  useEffect(() => {
    const stored = readStoredTasks();
    if (stored?.length) {
      setTasks(stored);
      return;
    }

    writeStoredTasks(mockTasks);
  }, []);

  const value = useMemo<TasksContextValue>(() => ({
    tasks,
    addTask: (input) => {
      const newTask = createTask(input);
      setTasks((current) => {
        const next = [newTask, ...current];
        writeStoredTasks(next);
        return next;
      });
      return newTask;
    },
    getTaskById: (id) => tasks.find((task) => task.id === id),
  }), [tasks]);

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks() {
  const context = useContext(TasksContext);
  if (!context) throw new Error("useTasks must be used inside TasksProvider");
  return context;
}