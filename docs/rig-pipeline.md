# Pipeline dựng rig cho mô hình người

> Tài liệu này mô tả pipeline asset rig ngoại tuyến đang được phát triển. Những phần chưa hoàn tất được đánh dấu **TODO**.

## Mục tiêu

Ứng dụng đang chuyển từ cách tạo rig và trọng số skin lúc tải trang sang một file GLB đã rig, tối ưu sẵn. Cách này giảm công việc runtime, giảm kích thước tải xuống và giúp mesh biến dạng tốt hơn ở vai, khuỷu tay, hông và gối. Chuyển động vẫn do IK thủ tục hiện có điều khiển; pipeline không thêm clip/keyframe animation.

## Các bước

1. **Nguồn:** `public/models/male-base.glb`, mesh nam cao ban đầu chưa có skin/animation.
2. **A — tạo rig và weight:** Blender chạy headless qua `tools/rig/blender_rig.py`, tạo `tools/rig/out/male-rigged.raw.glb`. Rig có 19 khớp theo tên/hệ tọa độ mà runtime sử dụng. **TODO:** xác nhận quy trình Blender và đầu ra cuối cùng trong môi trường phát hành.
3. **B — hoàn thiện:** `tools/rig/finalize.ts` hàn vertex, chuẩn hóa dữ liệu app-space, thêm hai morph đóng grip, lượng tử hóa và nén meshopt để tạo `public/models/male-rigged.glb`. Có thể dùng chế độ heuristic để dựng tạm từ asset gốc. Asset cuối phải giữ đúng hình học, khớp, morph và skin theo hợp đồng pipeline.
4. **C — runtime:** ứng dụng tải GLB đã rig; skeleton runtime tiếp tục được điều khiển bởi pose/IK thủ tục. **TODO:** xác nhận integration runtime và fallback-free load đã hoàn tất.

## Dựng lại và kiểm tra

Cần Node/npm, dependencies của dự án và Blender 5.2.2 theo cấu hình pipeline. Chạy từ thư mục gốc:

```sh
npm run rig:build
```

Sau đó chạy validator:

```sh
npx vite-node tools/rig/validate.ts
```

Lệnh build chỉ dành cho pipeline asset, không cần khởi động Vite. Không ghi đè hoặc xóa `public/models/male-base.glb`. Nếu chỉ muốn dựng asset tạm theo thuật toán heuristic, xem tùy chọn `--from-heuristic` của pipeline.

Validator cần kiểm tra asset đã giải mã: kích thước app-space cao 1.8 m, tâm X bằng 0, 19 khớp đúng vị trí nghỉ, trọng số hợp lệ, morph `gripL`/`gripR`, transform bind nhất quán và giới hạn kích thước. **TODO:** xác nhận chính xác cú pháp tùy chọn build/validate theo phiên bản script đã tích hợp và thêm hướng dẫn khắc phục lỗi Blender/meshopt.

## Giới hạn

Không có animation clip mới; rig chỉ phục vụ chuyển động thủ tục. Tư thế là minh họa kỹ thuật, không phải mocap. Không giảm polygon mặc định; tối ưu chủ yếu bằng bỏ UV, hàn vertex và nén. Giữ mesh nguồn nguyên vẹn để có thể dựng lại.
