# Worklog

Ghi lại các quyết định kỹ thuật, phân công, và brainstorming của nhóm.

> Cập nhật **bất cứ khi nào** nhóm ra quyết định kỹ thuật quan trọng hoặc thay đổi hướng đi.

---
### [ADR-1] Chọn hướng Multi-Agent Prediction Markets — 03/04/2026

**Bối cảnh:** Nhóm cần chọn đề tài AI in action có tính ứng dụng cao. Các lựa chọn ban đầu bao gồm chatbot, recommendation system, và AI prediction models.

**Các lựa chọn đã xem xét:**
- **AI prediction model**: dễ triển khai nhưng output tĩnh, thiếu tính tương tác
- **Decision support dashboard**: trực quan nhưng không xử lý tốt uncertainty
- **Prediction market + multi-agent**: phức tạp hơn nhưng có cơ chế self-correcting

**Quyết định:** Chọn hướng multi-agent prediction markets vì:
- Có cơ chế incentive (agents trade → reveal belief thật)
- Kết hợp được nhiều nguồn signal (data, news, reasoning)
- Phù hợp với decision-making under uncertainty

**Hệ quả:**  
- Tăng độ phức tạp hệ thống (cần market mechanism + agent design)  
- Cần xác định rõ use case và data source cho MVP 

---

### [ADR-2] Chuyển đổi sang Multi-Agent LLM & Hybrid Consensus — 10/04/2026

**Bối cảnh:** Nhóm nhận thấy mô phỏng xác suất thuần túy thiếu tính thuyết phục và không tận dụng được khả năng lập luận của AI. Cần một cơ chế đánh giá năng lực thực sự của Agent và Influencer.

**Các lựa chọn đã xem xét:**
- **Option A (Cũ):** Dùng các hàm toán học mô phỏng hành vi dự đoán.
- **Option B (Mới):** Dùng 5-10 LLM Agents khác nhau, kết hợp Synthetic Agents và cơ chế Upvote lập luận từ người dùng.

**Quyết định:** Chọn Option B vì:
- Tận dụng được khả năng Chain-of-Thought của các model lớn.
- Tạo ra thị trường dự đoán minh bạch (người dùng hiểu "tại sao" AI chọn kết quả đó).
- Có khả năng kiểm chứng (verifiability) thông qua lịch sử dự đoán.

**Hệ quả:**  
- Tăng chi phí API (cần gọi nhiều model cùng lúc).

---

### Sprint 2 — 04/04 → 11/04/2026

| Task | Người làm | Deadline | Trạng thái |
|---|---|---|---|
| Thay thế simulation bằng LLM Agents | Nam | 08/04 | 🔄 Đang làm |
| Thiết kế thuật toán tính Brier Score | Linh | 09/04 | 🔄 Đang làm |
| UI: Dashboard hiển thị Reasoning của Agent | Minh | 11/04 | ✅ Xong |
| Tích hợp Search Tool (Context Engineering) | Minh | 12/04 | 🔄 Đang làm |

---

### Brainstorm: Tăng độ tin cậy cho hệ thống (Trust Building) — 09/04/2026

**Câu hỏi:** Làm sao để người dùng tin vào xác suất mà AI đưa ra khi dự án mới launch?

**Các ý tưởng:**
- **Ý tưởng 1:** Show lịch sử kết quả của 100 sự kiện gần nhất.
- **Ý tưởng 2:** Cho phép người dùng nhấn "Peek" để xem nguồn dữ liệu mà AI đã thu thập được.
- **Ý tưởng 3:** Hệ thống cấp "Reputation Score" cho những AI Agent có phong độ ổn định nhất.

**Kết luận:** Thực hiện cả 3. Ưu tiên ý tưởng 1 để làm Landing Page thuyết phục nhà đầu tư/Coach.

---

### Quyết định kỹ thuật: Bỏ qua Large-scale RAG — 10/04/2026

**Vấn đề:** Câu hỏi dự đoán quá đa dạng, không thể index toàn bộ internet vào Vector DB.

**Giải pháp:** Sử dụng **On-demand Context Engineering**. Khi có câu hỏi, hệ thống sẽ trigger một Search Agent để lấy 3-5 snippets mới nhất, sau đó inject trực tiếp vào Prompt.

**Ưu điểm:** Tiết kiệm tài nguyên, dữ liệu luôn mới (real-time), giảm nhiễu thông tin.

## Template

### Quyết định kỹ thuật

```markdown
### [ADR-N] Tiêu đề quyết định — DD/MM/YYYY

**Bối cảnh:** Vấn đề cần giải quyết là gì?

**Các lựa chọn đã xem xét:**
- Option A: ...
- Option B: ...

**Quyết định:** Chọn option nào và tại sao.

**Hệ quả:** Những gì bị ảnh hưởng / trade-off.
```

### Phân công

```markdown
### Sprint N — DD/MM → DD/MM/YYYY

| Task | Người làm | Deadline | Trạng thái |
|---|---|---|---|
| | | | |
```

### Brainstorming

```markdown
### Brainstorm: [Chủ đề] — DD/MM/YYYY

**Câu hỏi:** ...

**Các ý tưởng:**
- Ý tưởng 1: ...
- Ý tưởng 2: ...

**Kết luận:** ...
```

---

## Ví dụ

### [ADR-1] Dùng TypeScript thay vì Python — 30/03/2026

**Bối cảnh:** Cả nhóm cần chọn 1 ngôn ngữ chính để xây dựng agent. Có 2 thành viên quen Python, 1 thành viên quen TypeScript.

**Các lựa chọn đã xem xét:**
- **Python**: Ecosystem ML tốt hơn, syntax đơn giản, thành viên quen hơn.
- **TypeScript**: Type safety, dễ refactor khi project lớn, nhiều library AI mới ra bản TS trước.

**Quyết định:** Chọn TypeScript vì project này focus vào agent architecture, không cần ML library nặng. Type safety sẽ giúp bắt lỗi sớm hơn khi codebase phình ra.

**Hệ quả:** 2 thành viên Python cần học TypeScript cơ bản (ước tính 1 tuần). Sẽ không dùng được `langchain` Python trực tiếp.

---

### [ADR-2] Lưu conversation history bằng file JSON — 03/04/2026

**Bối cảnh:** Agent cần nhớ context giữa các lần chạy. Cần chọn storage.

**Các lựa chọn đã xem xét:**
- **In-memory array**: Đơn giản nhất nhưng mất khi restart.
- **File JSON**: Persistent, không cần setup, dễ inspect bằng tay.
- **SQLite**: Có thể query, tốt cho production nhưng overkill cho prototype.
- **Redis**: Fast nhưng cần chạy thêm service.

**Quyết định:** File JSON cho giai đoạn prototype. Thiết kế interface `MemoryStore` để sau này swap sang SQLite không cần sửa logic agent.

**Hệ quả:** Không query được theo thời gian hay user. Chấp nhận được ở giai đoạn này.

---

### Sprint 1 — 31/03 → 06/04/2026

| Task | Người làm | Deadline | Trạng thái |
|---|---|---|---|
| Setup TypeScript project + CI | Văn A | 01/04 | ✅ Xong |
| Implement agent loop cơ bản | Thị B | 02/04 | ✅ Xong |
| Tool: `search_web` (Brave API) | Văn C | 03/04 | ✅ Xong |
| Tool: `read_file`, `write_file` | Thị B | 05/04 | ✅ Xong |
| Conversation memory (JSON) | Văn A | 06/04 | ✅ Xong |
| README + setup docs | Văn C | 06/04 | ✅ Xong |

---

### Sprint 2 — 07/04 → 13/04/2026

| Task | Người làm | Deadline | Trạng thái |
|---|---|---|---|
| Fix infinite loop: thêm `max_iterations` | Thị B | 08/04 | 🔄 Đang làm |
| Tool: `run_tests` (chạy pytest) | Văn C | 10/04 | ⏳ Chờ |
| Sliding window memory | Văn A | 09/04 | ⏳ Chờ |
| Demo prep + slides | Cả nhóm | 13/04 | ⏳ Chờ |

---

### Brainstorm: Tính năng cho demo — 05/04/2026

**Câu hỏi:** Demo tuần tới nên show gì để ấn tượng nhất trong 5 phút?

**Các ý tưởng:**
- **Ý tưởng 1 (Văn A):** Cho agent đọc 1 file Python có bug, tự fix, rồi chạy test để verify. Trực quan, dễ hiểu.
- **Ý tưởng 2 (Thị B):** Agent tự build 1 tính năng nhỏ từ mô tả bằng tiếng Việt. Show khả năng hiểu ngôn ngữ tự nhiên.
- **Ý tưởng 3 (Văn C):** Agent review PR, comment vào từng dòng code có vấn đề. Gần với use case thực tế nhất.

**Pros/Cons:**
| Ý tưởng | Pros | Cons |
|---|---|---|
| Fix bug | Dễ làm, chắc chắn chạy được | Ít "wow" hơn |
| Build từ mô tả | Ấn tượng nhất | Có thể fail nếu prompt phức tạp |
| Review PR | Thực tế, liên quan trực tiếp đến khóa học | Cần setup GitHub webhook |

**Kết luận:** Chọn ý tưởng 1 (fix bug) cho demo chính vì đảm bảo. Nếu còn thời gian sẽ show thêm ý tưởng 2 như bonus.

---

### Bug quan trọng: Tool call loop vô hạn — 04/04/2026

**Triệu chứng:** Agent gọi `search_web` liên tục không dừng khi tool trả về lỗi network.

**Root cause:** Không có stop condition khi tool raise exception. Agent nhận `"error": "timeout"` nhưng interpret là cần thử lại.

**Fix:** Thêm 2 điều kiện dừng:
1. `max_iterations = 10` — hard stop sau 10 vòng
2. Nếu tool trả về lỗi 3 lần liên tiếp → dừng và báo user

**Code thay đổi:** `src/agent.ts` lines 45-67

**Học được:** Luôn thiết kế stop condition trước khi implement retry logic.
