/** Kho bài — bốc ngẫu nhiên; mỗi người nhận CARDS_PER_TYPE (5) lá mỗi loại lúc mở ván */
/**
 * Helper: tạo object ảnh với 3 kích thước (thumb, medium, full) dạng WebP.
 */
function cardImg(baseName) {
    return {
        thumb:  `/images/optimized/${baseName}-thumb.webp`,
        medium: `/images/optimized/${baseName}-medium.webp`,
        full:   `/images/optimized/${baseName}-full.webp`,
        original: `/images/${baseName}.png`
    };
}

const CARD_POOLS = {
    innocent: [
        { id: 'I1', title: 'Công nhân nhà máy', desc: 'Làm việc 14 giờ/ngày để nuôi gia đình.', img: cardImg('iimg1') },
        { id: 'I2', title: 'Giáo viên vùng cao', desc: 'Dạy chữ miễn phí cho trẻ em dân tộc.', img: cardImg('iimg2') },
        { id: 'I3', title: 'Đảng viên chống tham nhũng', desc: 'Tố cáo đường dây biển thủ ngân sách.', img: cardImg('iimg3') },
        { id: 'I4', title: 'Bác sĩ tuyến đầu', desc: 'Từng cứu hàng trăm bệnh nhân dịch bệnh.', img: cardImg('iimg4') },
        { id: 'I5', title: 'Kỹ sư môi trường', desc: 'Thiết kế hệ thống giảm ô nhiễm cho khu công nghiệp.', img: cardImg('iimg5') },
        { id: 'I6', title: 'Người vô gia cư', desc: 'Mất việc vì khủng hoảng kinh tế.', img: cardImg('iimg6') },
        { id: 'I7', title: 'Người mẹ Đơn Thân', desc: 'Nuôi 3 con bằng đồng lương tối thiểu.', img: cardImg('iimg7') },
        { id: 'I8', title: 'Người nhập cư lao động', desc: 'Bị bóc lột nhưng vẫn gửi tiền về quê.', img: cardImg('iimg8') },
        { id: 'I9', title: 'Thẩm phán chính trực', desc: 'Người duy nhất dám đứng lên xử các vụ tham nhũng lớn.', img: cardImg('iimg9') },
        { id: 'I10', title: 'Sinh viên tình nguyện', desc: 'Góp công hỗ trợ cứu giúp mọi người vùng bão lũ.', img: cardImg('iimg10') }
    ],
    guilty: [
        { id: 'G1', title: 'Chủ tư bản bóc lột', desc: 'Cắt lương công nhân để tăng lợi nhuận.', img: cardImg('gimg1') },
        { id: 'G2', title: 'Quan chức tham nhũng', desc: 'Biển thủ tiền cứu trợ thiên tai.', img: cardImg('gimg2') },
        { id: 'G3', title: 'Tài phiệt Đầu cơ lương thực', desc: 'Tăng giá thực phẩm giữa dịch COVID-19', img: cardImg('gimg3') },
        { id: 'G4', title: 'Nhà đầu tư chiến tranh', desc: '"Kiếm lời từ sản xuất vũ khí.', img: cardImg('gimg4') },
        { id: 'G5', title: 'Tội phạm tài chính', desc: 'Làm sụp đổ quỹ hưu trí công nhân.', img: cardImg('gimg5') },
        { id: 'G6', title: 'Chủ Nhà Máy Ô Nhiễm', desc: 'Xả thải trái phép 15 năm, gây ô nhiễm môi trường.', img: cardImg('gimg6') },
        { id: 'G7', title: 'Tiến Sĩ Tín Dụng Đen', desc: 'Thiết kế hợp đồng bẫy hàng nghìn nông dân vào vòng nợ.', img: cardImg('gimg7') },
        { id: 'G8', title: 'Nhà Đầu Cơ Khủng Hoảng', desc: 'Tích trữ, thao túng giá lương thực, kiếm lời trong nạn đói.', img: cardImg('gimg8') },
        { id: 'G9', title: 'Kẻ Phá Vỡ Hòa Đàm', desc: 'Phá hoại các thỏa thuận hòa bình để buôn bán vũ khí.', img: cardImg('gimg9') },
        { id: 'G10', title: 'Kẻ Bán Dữ Liệu Y Tế', desc: 'Buôn bán hàng triệu dữ liệu bệnh án để vụ lợi.', img: cardImg('gimg10') }
    ],
    modifier: [
        { id: 'M1', title: 'Mâu Thuẫn Tiềm Ẩn', desc: '...NHƯNG tương lai sẽ trở thành nhà độc tài nhất.', img: cardImg('mimg1') },
        { id: 'M2', title: 'Ý Thức Hệ Thân Thuộc', desc: '...VÀ sẽ cứu một gia đình khỏi chết đói.', img: cardImg('mimg2') },
        { id: 'M3', title: 'Phủ Định Của Phủ Định', desc: '...NHƯNG tương lai sẽ gây ra khủng hoảng kinh tế.', img: cardImg('mimg3') },
        { id: 'M4', title: 'Chuyển Hóa Lượng Chất', desc: '...NHƯNG tương lai sẽ bán bí mật quốc gia.', img: cardImg('mimg4') },
        { id: 'M5', title: 'Bản Chất Ẩn Giấu', desc: '...NHƯNG tương lai sẽ tạo ra thuốc chữa ung thư.', img: cardImg('mimg5') },
        { id: 'M6', title: 'Bản Chất Ẩn Giấu', desc: '...Nhưng tương lai sẽ tài trợ học bổng cho 300 trẻ em nghèo mỗi năm.', img: cardImg('mimg6') },
        { id: 'M7', title: 'Bản Chất Ẩn Giấu', desc: '...Nhưng tương lai gia đình họ phụ thuộc hoàn toàn vào người này.', img: cardImg('mimg7') },
        { id: 'M8', title: 'Bản Chất Ẩn Giấu', desc: '...Nhưng tương lai sẽ gây ô nhiễm môi trường nghiêm trọng.', img: cardImg('mimg8') },
        { id: 'M9', title: 'Bản Chất Ẩn Giấu', desc: '...Nhưng tương lai sẽ dẫn đến nội chiến.', img: cardImg('mimg9') },
        { id: 'M10', title: 'Bản Chất Ẩn Giấu', desc: '...Tương lai sẽ trở thành lãnh tụ cách mạng cứu cả 1 dân tộc.', img: cardImg('mimg10') }
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

module.exports = { CARD_POOLS, CARD_TYPE_LABELS };
