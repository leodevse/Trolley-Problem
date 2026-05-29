# Lộ trình giai đoạn — Trolley Problem

Mỗi giai đoạn có **mục tiêu**, **cách kiểm tra**, và **phụ thuộc**. Chỉ chuyển giai đoạn tiếp theo khi bạn đã duyệt xong giai đoạn hiện tại.

| # | Tên | Mục tiêu | Trạng thái |
|---|-----|----------|------------|
| **1** | Local prototype | UI 2 cột + 3 vòng + thảo luận + bẻ ghi trên 1 máy | ✅ Hoàn thành |
| **2** | Phòng chờ | Tạo/vào phòng, chọn vai P1 / P2 / Lái tàu, host bắt đầu trận | ✅ |
| **3** | Socket.io | Đồng bộ realtime: bài, vòng, timer giữa 3 trình duyệt | ✅ Chờ bạn duyệt |
| **4** | Góc nhìn theo vai | Ẩn tay đối thủ; chỉ lái tàu thấy đủ bàn + nút bẻ ghi | ⏸ Chờ duyệt GĐ3 |
| **5** | Chat & deploy | Chat trong trận, deploy Railway | ⏸ Chờ duyệt GĐ4 |

---

## Giai đoạn 1 — Local (✅)

**Đã có:** `public/index.html` (bàn chơi), `game-local.js`, `cards-data.js`, Express tĩnh.

**Kiểm tra:** `npm start` → http://localhost:3000/play?mode=local

---

## Giai đoạn 2 — Phòng chờ (🔄)

**Mục tiêu:** 3 người trên 3 máy/tab: tạo phòng → chia mã → chọn vai → vào bàn (chưa đồng bộ lượt chơi).

**File mới/sửa:**
- `server.js` — API REST phòng (`/api/rooms/...`)
- `public/lobby.html`, `public/js/lobby.js`, `public/css/lobby.css`
- `public/play.html` — bàn chơi (tách khỏi lobby)
- Vào game: `/play?room=XXXX&player=<id>&role=p1|p2|conductor`

**Kiểm tra:**

1. Tab A: http://localhost:3000 → Tạo phòng → ghi mã 4 ký tự.
2. Tab B/C: Vào phòng → nhập tên → chọn 2 vai còn lại.
3. Khi đủ 3 vai → Host bấm **Bắt đầu trận** → cả 3 chuyển sang `/play`.
4. Tab **Chơi thử 1 máy** vẫn hoạt động: `/play?mode=local`.

**Giới hạn GĐ2 (cố ý):** Mỗi người vẫn chơi logic local riêng; đồng bộ thật ở GĐ3.

---

## Giai đoạn 3 — Socket.io (✅)

**Đã có:**
- `socket.io` + `server/game-engine.js` (state + timer trên server)
- `server/socket.js` — `join_game`, `play_card`, `verdict`
- `public/js/game-socket.js` — render theo `game:state` (tay bài riêng từng người)

**Kiểm tra:**
1. `npm start` (cần restart sau khi cài socket.io)
2. 3 tab: lobby → đủ vai → Host bắt đầu
3. P1 đặt bài → P2 & Lái tàu thấy ô đầy ngay
4. Đủ 2 bên vòng 1–3 → cả 3 tab chuyển vòng cùng lúc
5. Lái tàu bẻ ghi → tàu chạy trên cả 3 tab

---

## Giai đoạn 4 — Góc nhìn vai (⏸)

Theo `plan.md`:
- **Lái tàu:** thấy 6 ô bài đã lật, không thấy tay P1/P2, có cần gạt.
- **P1/P2:** thấy tay mình, drag-drop (hoặc click) đúng vòng, nút End Turn.

---

## Giai đoan 5 — Chat & Railway (⏸)

- Chat (Socket hoặc REST poll) trong giai đoạn thảo luận.
- `railway.json` / biến môi trường `PORT`, deploy.

---

## Lệnh chạy

```bash
npm install
npm start
```

- Lobby: http://localhost:3000  
- Local 1 máy: http://localhost:3000/play?mode=local
