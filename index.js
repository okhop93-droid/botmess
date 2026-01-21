const fs = require("fs");
const login = require("facebook-chat-api"); 
const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const DATA_FILE = "./data.json";

const getData = () => {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
        return { products: [] };
    }
};

const appState = JSON.parse(fs.readFileSync('appstate.json', 'utf8'));

login({appState}, (err, api) => {
    if(err) return console.error("Lỗi AppState, hãy lấy lại mã mới!");

    // Cấu hình quan trọng để giảm lỗi đỏ
    api.setOptions({
        listenEvents: true,
        selfListen: false,
        forceLogin: true,
        online: true
    });

    console.log("=== BOT ĐANG SẴN SÀNG NHẬN TIN ===");

    api.listenMqtt((err, message) => {
        // Fix lỗi đỏ: Bỏ qua hoàn toàn nếu gói tin bị lỗi hoặc không phải tin nhắn văn bản
        if (err || !message || message.type !== "message" || !message.body) return;

        const senderID = message.threadID;
        const msg = message.body.toLowerCase().trim();
        const data = getData();

        console.log(`Nhận tin từ ${senderID}: ${msg}`);

        const productID = parseInt(msg);
        const prod = data.products.find(p => p.id === productID);

        if (prod) {
            let info = `💳 THANH TOÁN: ${prod.name}\n`;
            info += `🏦 MSB - STK: 123456789\n`;
            info += `💰 Số tiền: ${prod.price.toLocaleString()}đ\n`;
            info += `📝 Nội dung: MUA${prod.id}${senderID}\n`;
            api.sendMessage(info, senderID);
        } else {
            let intro = "🤖 SHOP AUTO\n";
            data.products.forEach(p => {
                intro += `📍 Nhắn [${p.id}] để mua ${p.name}\n`;
            });
            api.sendMessage(intro, senderID);
        }
    });

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
                api.sendMessage(`✅ Code của bạn: ${code}`, userID);
            }
        }
        res.sendStatus(200);
    });
});

app.get("/", (req, res) => res.send("Bot Online"));
app.listen(process.env.PORT || 3000);
