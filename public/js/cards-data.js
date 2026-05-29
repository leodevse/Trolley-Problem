/** Kho bài — bốc ngẫu nhiên; mỗi người nhận CARDS_PER_TYPE (5) lá mỗi loại lúc mở ván */
const CARD_POOLS = {
    innocent: [
        { id: 'I1', title: 'Bác Sĩ Đầu Ngành', desc: 'Sắp tìm ra vắc-xin cứu sống hàng triệu người khỏi đại dịch.' },
        { id: 'I2', title: 'Kỹ Sư Năng Lượng', desc: 'Người duy nhất vận hành nhà máy lọc nước sạch cho cả thành phố.' },
        { id: 'I3', title: 'Mẹ Của Đàn Trẻ', desc: 'Đang nuôi dạy 5 đứa con thơ — tương lai công dân có ích.' },
        { id: 'I4', title: 'Nhà Toán Học', desc: 'Đang giải thuật toán tối ưu hóa giao thông, giảm tai nạn.' },
        { id: 'I5', title: 'Nhà Nông Học', desc: 'Sở hữu công thức hạt giống siêu năng suất xóa đói.' }
    ],
    guilty: [
        { id: 'G1', title: 'Kẻ Ích Kỷ Đạo Đức', desc: 'Móc túi tiền trợ cấp dưỡng lão để nướng vào sòng bạc.' },
        { id: 'G2', title: 'Kẻ Tráo Trở', desc: 'Tung tin đồn thất thiệt hại danh dự và sự nghiệp người khác.' },
        { id: 'G3', title: 'Kẻ Trốn Nghĩa Vụ', desc: 'Lén đổ rác thải y tế độc hại vào nguồn nước sinh hoạt.' },
        { id: 'G4', title: 'Kẻ Lừa Đảo', desc: 'Lập quỹ nhân đạo giả chiếm đoạt tài sản vùng thiên tai.' },
        { id: 'G5', title: 'Hacker Ác Ý', desc: 'Đang tấn công mạng điều phối xe cấp cứu bệnh viện.' }
    ],
    modifier: [
        { id: 'M1', title: 'Mâu Thuẫn Tiềm Ẩn', desc: '...NHƯNG tương lai người này phát minh vũ khí hủy diệt hàng loạt.' },
        { id: 'M2', title: 'Ý Thức Hệ Thân Thuộc', desc: '...VÀ người này mang huyết thống ruột thịt của bạn.' },
        { id: 'M3', title: 'Phủ Định Của Phủ Định', desc: '...NHƯNG nếu họ chết, tài sản bất chính sẽ chia cho người nghèo.' },
        { id: 'M4', title: 'Chuyển Hóa Lượng Chất', desc: '...NHƯNG cái chết kích hoạt lời nguyền xóa sổ ngẫu nhiên nửa thế giới.' },
        { id: 'M5', title: 'Bản Chất Ẩn Giấu', desc: '...THỰC CHẤT hành động tốt chỉ là chiêu trò truyền thông bẩn.' }
    ]
};

const CARD_TYPE_LABELS = {
    innocent: 'Vô tội',
    guilty: 'Có tội',
    modifier: 'Bổ sung'
};

const SLOT_LABELS = {
    innocent: { tag: 'THIÊN THẦN', sub: 'Vô tội' },
    guilty: { tag: 'ÁC QUỶ', sub: 'Có tội' },
    modifier: { tag: 'BỔ SUNG', sub: 'Định hướng tương lai' }
};
