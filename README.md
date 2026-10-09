# COURTSIDE — Pickleball Tactics 3D

MVP phase 1–4: Vite + TypeScript + Three.js, giao diện HTML/CSS thuần.

## Chạy

```sh
npm install
npm run dev
```

Mở URL Vite hiển thị. `npm run build` tạo thư mục `dist`; `npm run preview` xem bản production.

## Sử dụng

- **Chỉnh sửa:** nháy đúp (hoặc chạm hai lần trên mobile) vào người/nhãn để chọn người đánh. Kéo người chỉ đổi vị trí, không đổi người đánh; snap 0.1 m và cho phép ra ngoài sân, giới hạn vùng quanh sân X ±5 m / Z ±8.8 m để thực hiện ATP. Nếu kéo chính người đánh, điểm xuất phát của bóng đi theo người đó khi chưa cố định điểm tiếp xúc. Bấm vùng trống của sân để đặt điểm rơi ngay cho người đánh đã chọn; không cần bật nút đặt điểm rơi. Cuộn để zoom.
- **Xoay sân:** kéo để orbit; dùng 3D / Top / Baseline / Side để đổi góc nhìn. Trên điện thoại, chụm hai ngón để zoom trong chế độ xoay.
- Bảng cú đánh có 15 lựa chọn: Giao bóng, Drive, Dink, Drop, Lob, Volley, Smash, Block volley, Punch volley, Reset, Speed-up, Roll, Flick, ATP và Erne. Chọn người đánh, loại cú và **Đặt điểm rơi trên sân**. Có thể chọn vùng ngoài sân để thử OUT. Esc hủy chọn điểm.
- **Đón bóng / forehand-backhand:** app tự lấy điểm bóng đến từ cú trước. Kéo người nhận để app tìm vị trí đón trên lần nảy đầu và hiển thị vợt/FH/BH; không cần đặt điểm tiếp xúc hoặc cố định bóng bằng tay. Người nhận ngoài sân có thể đón bóng nảy để đánh ATP. Ngoài tầm với 1.1 m vẫn có cảnh báo.
- **Mô hình người / chuyển động:** ứng dụng đóng gói file GLB `public/models/male-base.glb` từ mesh do người dùng cung cấp, chuẩn hóa cao 1.8 m và hiện thêm rig 19 xương ở runtime (file gốc không có xương/animation). Vai, thân, cánh tay, bàn tay, hông, gối và cổ chân biến dạng cùng mesh; màu áo phân biệt đội. Tư thế lấy từ điểm tiếp xúc, hướng trả và loại cú; Play có chuẩn bị, theo đà, phục hồi và bước chân với chân trụ giữ điểm tiếp đất. Đây là chuyển động thủ tục minh họa kỹ thuật, không phải mocap.
- **Động tác riêng cho 15 cú:** lấy đà, chạm bóng, theo đà và phục hồi; Drive/Serve kết thúc qua vai, Smash xuống hông đối diện, Dink/Reset/Block có động tác ngắn, Roll/Flick xoay cổ tay rõ hơn, ATP hạ người ngoài biên và Erne bật nhẹ sang bên. Vợt có mặt dày, viền và cán quấn, nằm trong tay ở cả tư thế chờ. [Chi tiết động tác và tham khảo kỹ thuật](docs/stroke-motion.md).
- **Đổi nhãn đồng đội:** A1 ở vị trí A2 cũ, A2 ở A1 cũ; B1 ở B2 cũ, B2 ở B1 cũ. Kịch bản cũ được đổi ID/người đánh một lần và giữ nguyên tọa độ đường bóng. JSON mới lưu `playerLayout: 2` để reload/import không hoán đổi lần nữa.
- **Dink sát lưới:** điểm rơi chọn chính xác tới 0.01 m, không ép ra xa lưới. App tự nâng vòm nếu cần để vượt lưới ít nhất 4 cm, giới hạn đỉnh 12 m; có thể chỉnh đỉnh bằng tay. Nếu không thể qua lưới, giữ đúng điểm bạn chọn và báo NET. Dink dài/cross-court có thể rơi trong kitchen rồi nảy vượt biên: bật Dứt điểm, xem trail nét đứt màu cam và cảnh báo riêng; lần rơi đầu vẫn được tính IN.
- Điều chỉnh điểm đánh và đỉnh quỹ đạo (m); đỉnh không thấp hơn điểm đánh. Checkbox Volley cho biết bóng được đánh trước khi nảy.
- **Volley chặn giữa đường:** ở bước trả bóng, tick Volley và kéo người nhận tới đường bóng. App lấy đúng điểm trên chuyến bay đầu (cao 0.20–2.50 m, phía đội nhận), hiện đường tới nét đứt xanh và marker điểm chặn. Chiều cao tiếp xúc tự lấy từ quỹ đạo nên ô điểm đánh chỉ đọc; bỏ tick khôi phục chiều cao đón sau nảy. Play đưa bóng tới vợt trên đường bay gốc, cắt cú trước tại điểm chặn và trả bóng ngay. Đường vẽ và preview của cú trước cũng dừng ở điểm chặn trên không; preview cú trả bắt đầu ngay từ điểm đó, không phát lại đường bóng tới hoặc đi qua điểm rơi cũ. Người nhận tiến tới từ khi bóng còn đang bay; quỹ đạo kế hoạch/điểm rơi của cú trước vẫn được giữ trong JSON. Ngoài tầm với vẫn cảnh báo.
- **Topspin:** chỉ có một tick bật/tắt; mức xoáy lấy theo preset loại cú. Không có chọn backspin/sidespin hoặc chỉnh cường độ trong giao diện.
- **Độ nảy tự động:** app ước tính hệ số phục hồi theo loại cú và vận tốc chạm đất, rồi tính chiều cao/quãng nảy từ đỉnh quỹ đạo, chiều cao tiếp xúc và điểm rơi. Kết quả hiện cả khi chưa bật Dứt điểm. Đây là dự đoán chiến thuật gần đúng, chưa được hiệu chuẩn theo bóng/mặt sân thật.
- Tick **Dứt điểm** dưới Volley để bóng tiếp tục nảy/trượt sau điểm rơi. Bỏ tick (mặc định) thì bóng rơi và dừng đúng tại điểm rơi. Lựa chọn được lưu riêng cho mỗi cú; JSON cũ không có `finish` được hiểu là bỏ tick. `contactFixed` và tay thuận là thông tin tùy chọn, dữ liệu cũ vẫn tải được.
- **Xem cú đánh** phát riêng cú hiện tại. **Play** ở timeline luôn bắt đầu từ bước 1 và tự chạy liên tục đến hết, bóng luôn hiện và nối từ vị trí cuối cú trước tới điểm tiếp xúc cú tiếp theo. Đoạn nhận bóng dài 0.12–0.65 s tùy khoảng cách; người đánh tới vị trí trước khi đánh, đồng đội di chuyển mượt xuyên suốt chuyến bay, không có pha ẩn bóng/chờ đội hình. Pause giữ thời gian; chỉnh sửa hoặc chuyển bước sẽ kết thúc lần phát đang tạm dừng. Reset về bước đầu.
- **Thêm bước** giữ đội hình, chọn người nhận gần điểm rơi nhất ở đội đối diện và đặt bóng bắt đầu tại điểm rơi cũ. Cú sau giao bóng mặc định Drive; điểm trả mặc định hướng về người vừa đánh. Ghi chú để trống và Dứt điểm tắt. **Sao chép** vẫn giữ nguyên toàn bộ bước. Chỉnh bước mới không đổi bước cũ; luôn giữ ít nhất một bước, tối đa 100 bước.
- Tự lưu vào localStorage, reload khôi phục. **Xuất / Nhập JSON** lưu bản riêng. **Chia sẻ** mở link chứa kịch bản trong URL hash, không gửi lên server. Link được ưu tiên hơn bản lưu khi mở trang. Chỉnh sửa tiếp sẽ bỏ hash cũ để reload không khôi phục nhầm phiên bản trước đó.
- JSON không có `version` từ plan ban đầu được nhận như phiên bản 1. Editor chuyển dữ liệu cũ sang Topspin bật/tắt và độ nảy tự động. Các trường xoáy/độ nảy cũ vẫn đọc được để tương thích JSON; trong editor, Topspin và chế độ dự đoán tự động quyết định mô phỏng. File nhập tối đa 1 MB. Link rất dài có thể vượt giới hạn của ứng dụng nhắn tin; khi đó dùng JSON.

## Mô hình

Hệ tọa độ mét: x ngang, z dọc, y cao. Sân 6.10 × 13.41 m, kitchen 2.13 m mỗi bên. Lưới cao 0.864 m ở giữa / 0.914 m tại biên; mesh lưới dùng cùng hàm độ cao với bộ kiểm tra. Kích thước theo plan (làm tròn mét); tham khảo [USA Pickleball court layout](https://usapickleball.org/construction/).

Quỹ đạo không xoáy giữ mô hình g = 9.81 m/s², bán kính bóng 0.037 m. Trong editor, tick Topspin áp dụng mô hình Magnus gần đúng với gia tốc ép xuống và cản không khí tuyến tính. Thuật toán backspin/sidespin còn trong core để đọc/kiểm tra mô hình cũ, nhưng editor chỉ phát không xoáy hoặc topspin. Vận tốc xuất phát được giải lại để giữ nguyên điểm rơi và độ cao đỉnh đã chọn. Vì điểm rơi được cố định, hướng nhắm ban đầu cũng thay đổi khi đổi xoáy.

NET được tìm bằng chia quỹ đạo z(t) thành các khoảng đơn điệu rồi giải nghiệm giao mặt phẳng lưới bằng bisection, có kiểm tra độ rộng hữu hạn và độ cao lưới. Không lấy mẫu theo frame để quyết định va chạm, và một đường cong có thể có hai lần cắt mặt phẳng lưới. Va lưới thì bóng rơi tại đó và dừng.

Sau chạm đất, vận tốc đứng đảo chiều theo hệ số độ nảy được app tự ước tính. Topspin giữ tốc độ ngang tốt hơn sau va chạm; cường độ xoáy giảm sau mỗi lần nảy. Các đoạn nảy và góc quay bóng được tính theo thời gian, không theo số frame; dừng khi vận tốc nảy dưới 0.5 m/s. Bóng có texture để thấy hướng quay khi zoom gần; trail nét đứt hiển thị các lần nảy, màu cam khi vượt biên. Trail hiển thị chuyến bay tới điểm rơi/va lưới; bóng tiếp tục chuyển động qua các đoạn nảy khi bật Dứt điểm.

Đây là mô hình chiến thuật định tính: phần trăm spin không phải RPM đo thực tế; các hệ số Magnus/cản/ma sát chưa hiệu chuẩn theo loại bóng và mặt sân. Cơ sở hướng lực: [NASA — spinning ball lift](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/lift-of-a-soccer-ball/); cơ sở độ nảy: [Coefficient of restitution](https://phys.libretexts.org/Bookshelves/Classical_Mechanics/Classical_Mechanics_%28Tatum%29/05%3A_Collisions/5.02%3A_Bouncing_Balls).

Smash dùng điểm đánh cao và quỹ đạo đi xuống; Roll/Flick áp dụng topspin mặc định và cho phép bật/tắt; tư thế và vợt có chuyển động minh họa theo loại cú. ATP/Erne đặt điểm tiếp xúc lệch 0.55 m về phía biên so với marker người đánh; cần tự đặt người sát biên/cột phù hợp. Không tự xác nhận tính hợp lệ của Erne theo bước chân.

Các cú đánh được lưu độc lập theo ý đồ người dùng. Timeline nối chúng bằng đoạn nhận bóng nội suy, không thay đổi dữ liệu gốc; đoạn này minh họa sự liên tục, chưa phải cú đánh mới được giải bằng vật lý đầy đủ. Khi đoạn nối cắt qua lưới, độ cao được nâng để vượt lưới.

**OK / NET / OUT** biểu thị kiểm tra quỹ đạo và điểm rơi, không phải trọng tài đầy đủ. Kitchen là thuộc tính riêng. Giao bóng rơi kitchen và volley có điểm đánh trong kitchen hiển thị cảnh báo; chưa kiểm tra ô giao chéo, thứ tự giao bóng, two-bounce rule, chân người đánh, đà di chuyển hoặc bóng chạm người. Chưa có AI, multiplayer hoặc tài khoản. Chưa làm thư viện kịch bản mẫu thuộc phase 5.

## Kiểm tra

```sh
npm test
npm run build
npm run test:e2e
npm run test:contact
```

Các kiểm tra trình duyệt yêu cầu Vite đang chạy trên cổng 5173 và Chromium của Playwright (`npx playwright install chromium` nếu máy chưa có). `npm run test:e2e` (script `tests/browser.mjs`) tôn trọng biến `PREVIEW_URL`; `test:contact` và `test:volley` hiện dùng URL cố định http://localhost:5173/. Test browser kiểm tra kéo đủ 4 người, chọn điểm OUT/OK, tạo 3 bước, pause/resume, JSON, reload, link và mobile. `npm run test:volley` kiểm tra luồng đón volley giữa đường bay, gồm cập nhật tiếp xúc, preview và playback.

## Cloudflare Pages

Dự án là website tĩnh, đã sẵn sàng cấu hình Pages: build command `npm run build`, output `dist`, Node 22. Không cần worker, backend hoặc secret. Chưa deploy lên tài khoản Cloudflare.

## Cấu trúc

`src/core` chứa model, quỹ đạo, playback; `src/state` giữ trạng thái và tự lưu; `src/scene` tạo sân, capsule và bóng; `src/ui` tạo toolbar/timeline. `src/main.ts` nối scene với tương tác và vòng render, chỉ tiếp tục vẽ khi có thay đổi camera/state hoặc đang phát. Tab ẩn giữ thời gian phát. Font Be Vietnam Pro từ Google Fonts, có fallback system khi offline; geometry, texture lưới và nhãn được tạo bằng code. Mô hình người là asset 3D GLB được đóng gói tại `public/models/male-base.glb`.
