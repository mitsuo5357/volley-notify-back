const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
// ★ Firebaseの道具をインポート
const admin = require('firebase-admin');

// ★ Firebaseへの接続準備（秘密の鍵を読み込む）
const serviceAccount = require('./firebase-credentials.json'); 
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// ★ Firestoreデータベースに接続
const db = admin.firestore();

const app = express();

app.use(cors({
  origin: 'https://volley-notify.netlify.app/' 
}));
app.use(bodyParser.json());

const vapidKeys = {
  publicKey: 'BPyWZ7rIFoN2YjOXtbsditKuWydFJ38tnrK_HjfXNofZicldcOzU7kY34v58lCDvgZGSznXq5YGwlsauikIbVOQ',
  privateKey: '4ShqlgyVeSzhEhjpJ_NdVjI30h8S8s_MNfch2Q8_XKs'
};
webpush.setVapidDetails(
  'mailto:mitsuo5357@gmail.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);


// ★ 購読情報を「データベース」に保存するように変更
app.post('/subscribe', async (req, res) => {
  try {
    const subscription = req.body;
    // 'subscriptions'という名前のコレクションに新しいドキュメントとして保存
    await db.collection('subscriptions').add(subscription);
    console.log('購読情報をFirestoreに保存しました');
    res.status(201).json({ message: '購読成功' });
  } catch (error) {
    console.error('購読情報の保存中にエラー', error);
    res.status(500).json({ error: '購読失敗' });
  }
});


// ★ 通知送信時に「データベース」から購読情報を読み出すように変更
app.post('/send-notification', async (req, res) => {
  try {
　　// ↓リクエストからurlも受け取るようにする
　　const { title, body, url } = req.body; 
　　// ↓ペイロードにurlも追加する
　　const payload = JSON.stringify({ title, body, url });

    // 'subscriptions'コレクションから全ての購読情報を取得
    const subscriptionsSnapshot = await db.collection('subscriptions').get();
    const subscriptions = [];
    subscriptionsSnapshot.forEach(doc => {
      subscriptions.push(doc.data());
    });
    
    // 全員に通知を送信
    const sendPromises = subscriptions.map(subscription => 
      webpush.sendNotification(subscription, payload)
    );
    await Promise.all(sendPromises);

    // ★ 送信履歴を「データベース」に保存
    await db.collection('history').add({ title, body, sentAt: new Date() });
    
    console.log('通知を送信し、履歴を保存しました');
    res.status(200).json({ message: '通知が送信されました' });
  } catch (error) {
    console.error('通知の送信中にエラー', error);
    res.sendStatus(500);
  }
});


// ★ 送信履歴を「データベース」から読み出すエンドポイント
app.get('/history', async (req, res) => {
    try {
        const historySnapshot = await db.collection('history').orderBy('sentAt', 'desc').get();
        const history = [];
        historySnapshot.forEach(doc => {
            history.push(doc.data());
        });
        res.status(200).json(history);
    } catch (error) {
        console.error('履歴の取得中にエラー', error);
        res.status(500).json({ error: '履歴取得失敗' });
    }
});


const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`サーバーがポート ${port} で起動しました`);
});