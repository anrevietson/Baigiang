// Gọi Ollama /api/embed để tạo vector (embedding). Không cần gói nào ngoài Node.
export const ollamaHost = () => (process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434').replace(/\/$/, '').replace(/^(?!https?:\/\/)/, 'http://');
export const MO_HINH_MAC_DINH = process.env.TIM_KIEM_MODEL ?? 'bge-m3';

/** texts: string[] → Float32Array[] đã chuẩn hóa độ dài 1 */
export async function taoVector(texts, model = MO_HINH_MAC_DINH, { timeoutMs = 300000 } = {}) {
  const res = await fetch(`${ollamaHost()}/api/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, input: texts, truncate: true }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Ollama trả lỗi ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const { embeddings } = await res.json();
  if (!Array.isArray(embeddings) || embeddings.length !== texts.length) throw new Error('Ollama trả về sai số vector');
  return embeddings.map(chuanHoa);
}

export function chuanHoa(v) {
  const a = Float32Array.from(v);
  let n = 0;
  for (let i = 0; i < a.length; i++) n += a[i] * a[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < a.length; i++) a[i] /= n;
  return a;
}

export async function ollamaSanSang(model = MO_HINH_MAC_DINH) {
  try {
    const r = await fetch(`${ollamaHost()}/api/tags`, { signal: AbortSignal.timeout(2000) });
    if (!r.ok) return { ok: false, ly_do: `Ollama trả lỗi ${r.status}` };
    const { models = [] } = await r.json();
    const co = models.some((m) => m.name === model || m.name === `${model}:latest` || m.model === model);
    return co ? { ok: true } : { ok: false, ly_do: `Ollama chưa có mô hình "${model}". Chạy: ollama pull ${model}` };
  } catch {
    return { ok: false, ly_do: `Không kết nối được Ollama ở ${ollamaHost()}` };
  }
}

/** Văn bản đưa vào mô hình cho một đoạn: kèm chủ đề bài để đoạn ngắn không mất ngữ cảnh. */
export const vanBanDoan = (chuDe, noiDung) => (chuDe ? `${chuDe}\n\n${noiDung}` : noiDung);
