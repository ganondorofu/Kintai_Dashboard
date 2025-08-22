
import readline from 'readline';
import { initializeKiosk, watchTokenStatus, handleCardIdInput, createLinkRequest } from './firebase';
import { v4 as uuidv4 } from 'uuid';
import qrcode from 'qrcode-terminal';

// アプリケーションの状態
type AppState = 'WAITING' | 'QR_DISPLAY' | 'CARD_LINKING';
let currentState: AppState = 'WAITING';
let currentToken = '';
let unsubscribe: (() => void) | null = null;
let currentCardId: string | null = null;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const displayMenu = () => {
  console.clear();
  switch (currentState) {
    case 'WAITING':
      console.log('\n======================================');
      console.log('      IT勤怠管理キオスク          ');
      console.log('======================================\n');
      console.log('NFCカードをタッチするか、カードIDを入力してください...');
      console.log('\n--------------------------------------');
      console.log('「/」を入力してEnterでカード登録モードに切り替え');
      console.log('======================================');
      break;
    case 'QR_DISPLAY':
      console.log('\n======================================');
      console.log('        カード登録モード            ');
      console.log('======================================\n');
      console.log('スマートフォンでQRコードを読み取ってください。');
      const registrationUrl = `https://kintai-dashboard.vercel.app/register?token=${currentToken}&cardId=${currentCardId}`;
      qrcode.generate(registrationUrl, { small: true });
      console.log(`\nURL: ${registrationUrl}`);
      console.log('\nQRコード読み取り後、次の指示をお待ちください...');
      console.log('\n--------------------------------------');
      console.log('「c」を入力してEnterでキャンセル');
      console.log('======================================');
      break;
    case 'CARD_LINKING':
      console.log('\n======================================');
      console.log('        カード登録モード            ');
      console.log('======================================\n');
      console.log('✅ スマートフォンでの認証が完了しました。');
      console.log('\n登録したいNFCカードをタッチしてください...');
      console.log('\n--------------------------------------');
      console.log('「c」を入力してEnterでキャンセル');
      console.log('======================================');
      break;
  }
};

const resetToWaiting = () => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  currentState = 'WAITING';
  currentToken = '';
  currentCardId = null;
  displayMenu();
};

const startRegistrationMode = async (cardId: string) => {
  currentState = 'QR_DISPLAY';
  currentToken = uuidv4();
  currentCardId = cardId;
  
  try {
    await createLinkRequest(currentToken);
    displayMenu();

    // トークンの状態を監視
    unsubscribe = watchTokenStatus(currentToken, (status, data) => {
      if (status === 'opened') {
        currentState = 'CARD_LINKING';
        displayMenu();
      } else if (status === 'done') {
        console.log('\n🎉 カード登録が完了しました！');
        setTimeout(resetToWaiting, 3000);
      }
    });

  } catch (error) {
    console.error('トークン作成エラー:', error);
    console.log('エラーが発生しました。3秒後に待機画面に戻ります。');
    setTimeout(resetToWaiting, 3000);
  }
};


rl.on('line', async (input) => {
  const line = input.trim();

  if (currentState === 'WAITING') {
    if (line === '/') {
      console.log('登録したいカードIDを入力してください: ');
      rl.question('', (cardId) => {
        if(cardId) {
            startRegistrationMode(cardId);
        } else {
            console.log('カードIDが入力されませんでした。');
            displayMenu();
        }
      });
    } else {
      const result = await handleCardIdInput(line);
      console.log(`\n[${result.status.toUpperCase()}] ${result.message}`);
      if (result.subMessage) console.log(result.subMessage);
      
      if(result.status === 'unregistered') {
        startRegistrationMode(line);
      } else {
        setTimeout(displayMenu, 3000);
      }
    }
  } else if (currentState === 'QR_DISPLAY' || currentState === 'CARD_LINKING') {
    if (line.toLowerCase() === 'c') {
      console.log('\nキャンセルしました。');
      resetToWaiting();
    } else if (currentState === 'CARD_LINKING' && line) {
        // カードIDが入力された（タッチされた）
        try {
            await handleCardIdInput(line, currentToken);
        } catch (error) {
            console.error('カード紐付けエラー:', error);
        }
    }
  }
});


const main = async () => {
  await initializeKiosk();
  displayMenu();
};

main().catch(error => {
  console.error("キオスクの起動に失敗しました:", error);
  process.exit(1);
});
