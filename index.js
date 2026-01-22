const fs = require("fs");
const login = require("facebook-chat-api"); 
const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const DATA_FILE = "./data.json";

// Hàm đọc dữ liệu kho hàng
const getData = () => {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
        return { products: [] };
    }
};

// Đọc AppState
const appState = JSON.parse(fs.readFileSync('appstate.json', 'utf8'));

login({appState}, (err, api) => {
    if(err) {
        console.error("❌ LỖI: AppState không hợp lệ hoặc đã hết hạn. Hãy lấy lại mã mới từ Kiwi Browser!");
        return;
    }

    // Cấu hình bot để hoạt động ổn định nhất
    api.setOptions({
        listenEvents: true,
        selfListen: false, // Bot không tự trả lời chính mình
        forceLogin: true,
        online: true,
        autoMarkDelivery: true, // Đánh dấu đã phát tin nhắn
        autoMarkRead: true      // Đánh dấu đã đọc tin nhắn
    });

    console.log("✅ === BOT ĐANG SẴN SÀNG NHẬN TIN TỪ MESSENGER ===");

    api.listenMqtt((err, message) => {
        // Lọc tin nhắn: Chỉ xử lý tin nhắn văn bản (type: message)
        if (err || !message || message.type !== "message" || !message.body) return;

        const senderID = message.threadID;
        const msg = message.body.toLowerCase().trim();
        const data = getData();

        console.log(`📩 Nhận tin từ [${senderID}]: ${msg}`);

        // Kiểm tra xem khách nhắn số ID hay nhắn chữ
        const productID = parseInt(msg);
        const prod = data.products.find(p => p.id === productID);

        if (prod) {
            // Khách nhắn đúng ID sản phẩm
            let info = `💳 THÔNG TIN THANH TOÁN: ${prod.name.toUpperCase()}\n`;
            info += `--------------------------\n`;
            info += `🏦 Ngân hàng: MSB\n`;
            info += `🔢 STK: 123456789\n`;
            info += `👤 Chủ TK: NGUYEN VAN A\n`;
            info += `💰 Số tiền: ${prod.price.toLocaleString()}đ\n`;
            info += `📝 Nội dung: MUA${prod.id}${senderID}\n`;
            info += `--------------------------\n`;
            info += `🤖 Hệ thống sẽ gửi Code ngay khi nhận được tiền!`;
            
            api.sendMessage(info, senderID, (err) => {
                if(err) console.error("❌ Lỗi gửi tin nhắn thanh toán:", err);
            });
        } else {
            // Khách nhắn linh tinh -> Gửi Menu giới thiệu
            let intro = "🤖 XIN CHÀO! ĐÂY LÀ SHOP GAME AUTO\n\n";
            intro += "Danh mục sản phẩm hiện có:\n";
            data.products.forEach(p => {
                intro += `📍 Nhắn [${p.id}] để mua: ${p.name} (${p.price.toLocaleString()}đ)\n`;
            });
            intro += "\n👉 Bạn hãy nhắn đúng con số ID để nhận thông tin chuyển khoản.";
            
            api.sendMessage(intro, senderID, (err) => {
                if(err) console.error("❌ Lỗi gửi Menu:", err);
            });
        }
    });

    // Xử lý nạp tiền tự động từ Webhook SePay
    app.post("/sepay-webhook", (req, res) => {
        const { content, transferAmount } = req.body;
        const data = getData();

        // Tìm MUA[ID][UserID] trong nội dung chuyển khoản
        const match = content.match(/MUA(\d+)(\d+)/i);
        if (match) {
            const prodID = parseInt(match[1]);
            const userID = match[2];
            const prod = data.products.find(p => p.id === prodID);

            if (prod && transferAmount >= prod.price && prod.stock.length > 0) {
                const code = prod.stock.shift(); // Lấy 1 mã ra khỏi kho
                fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

                const successMsg = `✅ THANH TOÁN THÀNH CÔNG!\n🎁 Code của bạn là: ${code}\nCảm ơn bạn đã tin dùng dịch vụ!`;
                api.sendMessage(successMsg, userID);
            }
        }
        res.sendStatus(200);
    });
});

app.get("/", (req, res) => res.send("Bot Messenger is Active!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌍 Server listening on port ${PORT}`));
            
