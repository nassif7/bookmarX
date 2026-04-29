import type { ToastItem } from '../../types';

interface Props {
  toasts: ToastItem[];
}

export default function ToastContainer({ toasts }: Props) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
      ))}
    </div>
  );
}
