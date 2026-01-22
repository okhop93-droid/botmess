const fs = require("fs");
const login = require("facebook-chat-api"); 
const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const DATA_FILE = "./data.json";

// Hàm đọc dữ liệu kho hàng an toàn
const getData = () => {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
        return { products: [] };
    }
};

// Đọc AppState từ file
const appState = JSON.parse(fs.readFileSync('appstate.json', 'utf8'));

login({appState}, (err, api) => {
    if(err) {
        console.error("❌ Lỗi AppState: Có thể đã hết hạn, hãy lấy mã mới từ Kiwi Browser!");
        return;
    }

    // Cấu hình bot tối ưu để tránh bị Facebook quét
    api.setOptions({
        listenEvents: true,
        selfListen: false,
        forceLogin: true,
        online: true,
        autoMarkRead: true
    });

    console.log("✅ === BOT ĐANG SẴN SÀNG NHẬN TIN ===");

    api.listenMqtt((err, message) => {
        // Fix lỗi đỏ trong log: Bỏ qua nếu gói tin lỗi hoặc không phải tin nhắn văn bản
        if (err || !message || message.type !== "message" || !message.body) return;

        const senderID = message.threadID;
        const msg = message.body.toLowerCase().trim();
        const data = getData();

        console.log(`📩 Nhận tin từ [${senderID}]: ${msg}`);

        const productID = parseInt(msg);
        const prod = data.products.find(p => p.id === productID);

        if (prod) {
            let info = `💳 THANH TOÁN: ${prod.name.toUpperCase()}\n`;
            info += `--------------------------\n`;
            info += `🏦 Ngân hàng: MSB\n`;
            info += `🔢 STK: 123456789\n`;
            info += `💰 Số tiền: ${prod.price.toLocaleString()}đ\n`;
            info += `📝 Nội dung: MUA${prod.id}${senderID}\n`;
            info += `--------------------------\n`;
            info += `🤖 Hệ thống tự gửi Code sau khi nhận đủ tiền!`;
            api.sendMessage(info, senderID);
        } else {
            let intro = "🤖 SHOP GAME AUTO\n\n";
            intro += "Danh mục sản phẩm:\n";
            data.products.forEach(p => {
                intro += `📍 Nhắn [${p.id}] mua: ${p.name} - ${p.price.toLocaleString()}đ\n`;
            });
            intro += "\n👉 Nhắn đúng số ID để lấy thông tin chuyển khoản.";
            api.sendMessage(intro, senderID);
        }
    });

    // Xử lý Webhook SePay nạp tiền tự động
    app.post("/sepay-webhook", (req, res) => {
        const { content, transferAmount } = req.body;
        const data = getData();
        const match = content.match(/MUA(\d+)(\d+)/i);
        
        if (match) {
            const prodID = parseInt(match[1]);
            const userID = match[2];
            const prod = data.products.find(p => p.id === prodID);

            if (prod && transferAmount >= prod.price && prod.stock.length > 0) {
                const code = prod.stock.shift();
                fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
                api.sendMessage(`✅ Thanh toán thành công!\n🎁 Code của bạn: ${code}`, userID);
            }
        }
        res.sendStatus(200);
    });
});

app.get("/", (req, res) => res.send("Bot is Online!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌍 Server listening on port ${PORT}`));
        
