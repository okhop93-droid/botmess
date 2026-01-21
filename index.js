const fs = require("fs");
const login = require("facebook-chat-api"); // Đã đổi thư viện chính thống
const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const DATA_FILE = "./data.json";

// Hàm đọc dữ liệu an toàn
const getData = () => {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
        return { products: [], orders: [] };
    }
};

// Đăng nhập bằng appstate.json
const appState = JSON.parse(fs.readFileSync('appstate.json', 'utf8'));

login({appState}, (err, api) => {
    if(err) {
        console.error("Lỗi đăng nhập: Kiểm tra lại file appstate.json");
        return;
    }

    // Cấu hình bot
    api.setOptions({ listenEvents: true, selfListen: false });

    console.log("Bot Messenger đang LIVE...");

    api.listenMqtt((err, message) => {
        if(err || !message || !message.body) return;

        const senderID = message.threadID;
        const msg = message.body.toLowerCase().trim();
        const data = getData();

        // Kiểm tra xem khách có nhắn ID sản phẩm (số) không
        const productID = parseInt(msg);
        const prod = data.products.find(p => p.id === productID);

        if (prod) {
            let info = `💳 THANH TOÁN: ${prod.name.toUpperCase()}\n`;
            info += `--------------------------\n`;
            info += `🏦 Ngân hàng: MSB\n`;
            info += `🔢 STK: 123456789\n`;
            info += `👤 Chủ TK: NGUYEN VAN A\n`;
            info += `💰 Số tiền: ${prod.price.toLocaleString()}đ\n`;
            info += `📝 Nội dung: MUA${prod.id}${senderID}\n`;
            info += `--------------------------\n`;
            info += `🤖 Chuyển đúng nội dung để nhận code ngay!`;
            api.sendMessage(info, senderID);
        } else {
            // Phản hồi khi có bất kỳ tin nhắn nào khác
            let intro = "🤖 SHOP GAME AUTO XIN CHÀO!\n\n";
            intro += "Danh sách sản phẩm hiện có:\n";
            data.products.forEach(p => {
                intro += `📍 Nhắn [${p.id}] mua: ${p.name} - ${p.price.toLocaleString()}đ\n`;
            });
            intro += "\n👉 Chỉ cần nhắn số ID để nhận STK.";
            api.sendMessage(intro, senderID);
        }
    });

    // Xử lý Webhook SePay
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

                api.sendMessage(`✅ Giao dịch thành công!\n🎁 Code của bạn là: ${code}`, userID);
            }
        }
        res.sendStatus(200);
    });
});

// Giữ cho Render không bị chết (Keep-alive)
app.get("/", (req, res) => res.send("Bot đang chạy ổn định!"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
