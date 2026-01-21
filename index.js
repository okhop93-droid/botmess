const fs = require("fs");
const login = require("fb-chat-api-temp");
const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const DATA_FILE = "./data.json";

// Đọc dữ liệu từ file
const getData = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

// Đăng nhập Facebook
login({appState: JSON.parse(fs.readFileSync('appstate.json', 'utf8'))}, (err, api) => {
    if(err) {
        console.error("Lỗi đăng nhập: Hãy kiểm tra file appstate.json");
        return;
    }

    console.log("Bot Messenger đang hoạt động...");

    // Tự động trả lời tin nhắn
    api.listenMqtt((err, message) => {
        if(err || !message.body) return;

        const senderID = message.threadID;
        const msg = message.body.toLowerCase().trim();
        const data = getData();

        // Kiểm tra nếu tin nhắn là một con số (ID sản phẩm)
        const productID = parseInt(msg);
        const prod = data.products.find(p => p.id === productID);

        if (prod) {
            let info = `💳 THÔNG TIN THANH TOÁN [${prod.name}]\n`;
            info += `--------------------------\n`;
            info += `🏦 Ngân hàng: MSB\n`;
            info += `🔢 STK: 123456789\n`;
            info += `👤 Chủ TK: NGUYEN VAN A\n`;
            info += `💰 Số tiền: ${prod.price.toLocaleString()}đ\n`;
            info += `📝 Nội dung: MUA${prod.id}${senderID}\n`;
            info += `--------------------------\n`;
            info += `🤖 Hệ thống sẽ tự gửi Code sau khi nhận tiền!`;
            api.sendMessage(info, senderID);
        } else {
            // Tin nhắn bất kỳ: Gửi Menu
            let intro = "🤖 SHOP AUTO XIN CHÀO!\n\n";
            intro += "Danh sách sản phẩm:\n";
            data.products.forEach(p => {
                intro += `🔹 Nhắn [${p.id}] để mua: ${p.name} - ${p.price.toLocaleString()}đ\n`;
            });
            intro += "\n👉 Bạn chỉ cần nhắn đúng con số ID để lấy thông tin thanh toán.";
            api.sendMessage(intro, senderID);
        }
    });

    // Xử lý nạp tiền từ SePay
    app.post("/sepay-webhook", (req, res) => {
        const { content, transferAmount } = req.body;
        const data = getData();

        // Tìm MUA[ID][UserID]
        const match = content.match(/MUA(\d+)(\d+)/i);
        if (match) {
            const prodID = parseInt(match[1]);
            const userID = match[2];
            const prod = data.products.find(p => p.id === prodID);

            if (prod && transferAmount >= prod.price && prod.stock.length > 0) {
                const code = prod.stock.shift();
                fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

                api.sendMessage(`✅ Thanh toán thành công!\n🎁 Code của bạn là: ${code}`, userID);
            }
        }
        res.sendStatus(200);
    });
});

// Port cho Render
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot is running!")); // Để Render không báo lỗi
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
                  
