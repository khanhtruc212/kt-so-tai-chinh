/* ===========================================================
   CẤU HÌNH KT · SỔ TÀI CHÍNH
   Sửa file này để bật Cloud Sync và gắn link khóa học.
   (anon key của Supabase là khóa công khai, an toàn để đặt ở đây)
   =========================================================== */
window.KT_CONFIG = {
  // --- Cloud sync (Supabase). Để trống "" nếu chưa dùng → app lưu trên thiết bị. ---
  supabaseUrl:     "",   // VD: https://abcdxyz.supabase.co
  supabaseAnonKey: "",   // anon public key trong Project Settings → API

  // --- Lead magnet: link khóa học / coaching cho từng màn hình ---
  // Thay "#" bằng URL thật (trang khóa học, landing, Zalo, form đăng ký...)
  links: {
    jars:     "#",  // 6 chiếc lọ / phân bổ thu nhập
    assets:   "#",  // Xây tài sản – thoát tiêu sản
    goals:    "#",  // Coaching mục tiêu tài chính
    budget:   "#"   // Kiểm soát chi tiêu / ngân sách
  },

  // --- Mặc định ---
  reminderTime: "21:00"
};
