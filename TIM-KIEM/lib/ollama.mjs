// Gọi Ollama /api/embed để tạo vector (embedding). Không cần gói nào ngoài Node.
export const ollamaHost = () => (process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434').replace(/\/$/, '').replace(/^(?!https?:\/\/)/, 'http://');
export const MO_HINH_MAC_DINH = process.env.TIM_KIEM_MODEL ?? 'bge-m3';

async function goiOllama(path, options, timeoutMs) {
  try {
    return await fetch(`${ollamaHost()}${path}`, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
      throw new Error(`Ollama quá thời gian chờ (${timeoutMs} ms) tại ${ollamaHost()}`);
    }
    throw new Error(`Không kết nối được Ollama ở ${ollamaHost()}: ${e.message}`);
  }
}

/** texts: string[] → Float32Array[] đã chuẩn hóa độ dài 1 */
export async function taoVector(texts, model = MO_HINH_MAC_DINH, { timeoutMs = 300000 } = {}) {
  if (!Array.isArray(texts) || !texts.length || texts.some((text) => typeof text !== 'string')) {
    throw new TypeError('Danh sách văn bản tạo vector phải là mảng chuỗi không rỗng');
  }
  const res = await goiOllama('/api/embed', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, input: texts, truncate: true }),
  }, timeoutMs);
  if (!res.ok) throw new Error(`Ollama trả lỗi ${res.status}: ${(await res.text()).slice(0, 300)}`);
  let data;
  try { data = await res.json(); } catch { throw new Error('Ollama trả về JSON không hợp lệ'); }
  const { embeddings } = data;
  if (!Array.isArray(embeddings) || embeddings.length !== texts.length) throw new Error('Ollama trả về sai số vector');
  if (embeddings.some((v) => !Array.isArray(v) || !v.length || v.some((x) => !Number.isFinite(x)))) {
    throw new Error('Ollama trả về vector không hợp lệ');
  }
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
    const r = await goiOllama('/api/tags', {}, 2000);
    if (!r.ok) return { ok: false, ly_do: `Ollama trả lỗi ${r.status}` };
    let data;
    try { data = await r.json(); } catch { return { ok: false, ly_do: 'Ollama trả về JSON không hợp lệ' }; }
    const { models = [] } = data;
    const co = models.some((m) => m.name === model || m.name === `${model}:latest` || m.model === model);
    return co ? { ok: true } : { ok: false, ly_do: `Ollama chưa có mô hình "${model}". Chạy: ollama pull ${model}` };
  } catch (e) {
    return { ok: false, ly_do: e.message };
  }
}

/** Văn bản đưa vào mô hình cho một đoạn: kèm chủ đề bài để đoạn ngắn không mất ngữ cảnh. */
export const vanBanDoan = (chuDe, noiDung) => (chuDe ? `${chuDe}\n\n${noiDung}` : noiDung);
