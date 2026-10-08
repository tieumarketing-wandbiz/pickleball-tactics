# Động tác theo cú đánh

Mô hình dùng mesh người được cung cấp và rig thủ tục. Các đường vung và tư thế lấy cảm hứng từ hướng dẫn kỹ thuật thi đấu, không phải dữ liệu motion capture hoặc phép đo khớp của vận động viên.

| Cú | Động tác thể hiện |
| --- | --- |
| Giao bóng | Lấy đà thấp bên hông, tay còn lại đưa bóng, chuyển trọng tâm và kết thúc qua vai |
| Drive | Xoay hông/vai, đưa vợt thấp–cao và qua vai đối diện; backhand có tay hỗ trợ |
| Dink | Hạ gối theo bóng, giữ vai ổn định, động tác nâng ngắn với mặt vợt mở |
| Drop | Vung mềm, ít xoay thân và kết thúc vừa phải |
| Lob | Đưa vợt từ thấp lên cao, nâng dài hơn Drop/Dink |
| Volley | Vợt ở trước thân, lấy đà và theo đà ngắn |
| Smash | Xoay nghiêng khi lấy đà, vợt trên đầu, tay còn lại chỉ bóng rồi hạ xuống; kết thúc ở hông đối diện |
| Block volley | Giữ vợt mở, hấp thụ bóng bằng dịch chuyển nhỏ về thân, gần như không vung tiếp |
| Punch volley | Đẩy vợt ngắn ra phía trước, cổ tay ổn định |
| Reset | Tay mềm và đường vợt ngắn, ít xoay vai |
| Speed-up | Gia tốc nhanh từ vị trí vợt trước thân, kết thúc ngắn hơn Drive |
| Roll | Vợt thấp–cao và úp mặt qua bóng rõ hơn |
| Flick | Động tác tay ngắn với xoay cổ tay nhanh |
| ATP | Hạ trọng tâm, đứng rộng, nghiêng ra phía điểm tiếp xúc và đưa vợt vòng bên ngoài |
| Erne | Bật nhẹ sang bên, vung volley ngắn và trở lại tư thế chờ; không xác nhận luật bàn chân |

Mốc chạm bóng là thời gian 0. Hermite interpolation giữ vận tốc vợt liên tục qua mốc này. Cú đầu có pha chuẩn bị 0.16–0.48 s; các cú kế tiếp lấy đà trong đoạn đón bóng đang có. Preview chạy đủ pha phục hồi, còn timeline tiếp tục chuyển bóng giữa các bước. Pause giữ cả khớp, vợt và bóng.

Vợt dùng blade bo góc, độ dày, viền, họa tiết carbon, cổ nối, cán quấn và nút cuối cán. Mặt trước đặt phía sau tâm bóng để mô tả tiếp xúc; IK giữ cán ở tay. Morph grip gập ngón tay của mesh nguồn, tay không đánh vẫn mở. Mọi người cầm vợt ở tư thế chờ. Các tọa độ bóng không được thay bởi đường vung minh họa; vị trí ngoài tầm với vẫn bị giới hạn bởi chiều dài tay.

Tham khảo kỹ thuật: [Selkirk — power, body rotation and follow-through](https://www.selkirk.com/blogs/pickleball-education/how-to-maximize-power-in-your-pickleball-game-without-sacrificing-control), [Catherine Parenteau — block volley](https://www.selkirk.com/blogs/pickleball-education/why-you-should-use-the-pickleball-block-volley-and-how-to-do-it-tips-from-pro-catherine-parenteau), [Selkirk — overhead contact and opposite-hip finish](https://www.selkirk.com/blogs/pickleball-education/improve-your-overhead-shot-common-mistakes-and-drills-to-fix-them), [Selkirk — volley grip and rolling action](https://www.selkirk.com/blogs/pickleball-education/mastering-the-pickleball-volley-shot-tips-for-former-tennis-players).


### Tay cầm vợt

Định vị cổ tay và mặt phẳng bàn tay theo mesh GLB thực tế, thay vì đặt ngón tay dọc trục cán. Cán nằm hơi chéo qua lòng bàn tay; bốn ngón cuộn quanh tiết diện cán và ngón cái khép phía đối diện. Morph giữ độ dày ngón, kèm normal riêng và trọng số da liền ở cổ tay. Xoay sấp/ngửa được phân bổ qua cẳng tay để giảm gãy cổ tay.

Cán tám cạnh dài 15.8 cm, tay chính cầm thấp và tay phụ cao hơn 7.5 cm khi đánh backhand hai tay. Khi tay phụ chưa tới được cán trong lấy đà hoặc theo đà, bàn tay mở dần thay vì nắm vào khoảng không. Góc vợt ở tầm thấp/ngang hông được điều chỉnh theo điểm tiếp xúc. Đây vẫn là tư thế được dựng thủ tục, không phải dữ liệu đo chuyển động.

Cách đặt tay phụ phía trên tay chính tham khảo [Selkirk — Catherine Parenteau groundstroke/backhand guidance](https://www.selkirk.com/blogs/pickleball-education/how-to-unlock-a-winning-groundstroke-tips-from-pro-catherine-parenteau-on-selkirk-tv).
