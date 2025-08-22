import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { createLinkRequest, watchTokenStatus } from '@/lib/data-adapter';

/**
 * 既存システム互換：QRコードを使ったRaspberry Pi連携
 * NFCカードとユーザーアカウントを紐づけるためのコンポーネント
 */
export const QRLinkComponent = () => {
  const [token, setToken] = useState<string>('');
  const [linkStatus, setLinkStatus] = useState<'waiting' | 'linked' | 'done'>('waiting');
  const [error, setError] = useState<string>('');

  // トークン生成とQRコード表示
  useEffect(() => {
    const generateToken = async () => {
      try {
        // UUIDを生成（既存システム互換）
        const newToken = crypto.randomUUID();
        setToken(newToken);
        
        // Firestoreにトークンを保存
        await createLinkRequest(newToken);
        
        // トークンの状態を監視
        const unsubscribe = watchTokenStatus(newToken, (status, data) => {
          setLinkStatus(status as 'waiting' | 'linked' | 'done');
          if (status === 'done') {
            // 連携完了時の処理
            console.log('カード連携が正常に完了しました:', data);
          }
        });
        
        return unsubscribe;
      } catch (err) {
        console.error('トークン生成エラー:', err);
        setError('トークンの生成に失敗しました');
      }
    };

    generateToken();
  }, []);

  // QRコードのURL（既存システム互換）
  const qrUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/link?token=${token}`;

  return (
    <div className="flex flex-col items-center space-y-4 p-6">
      <h2 className="text-xl font-bold">カード連携</h2>
      
      {error && (
        <div className="text-red-500 p-2 border border-red-300 rounded">
          {error}
        </div>
      )}
      
      {token && (
        <div className="flex flex-col items-center space-y-4">
          <QRCodeSVG 
            value={qrUrl} 
            size={200}
            className="border p-4"
          />
          
          <div className="text-center">
            <p className="text-sm text-gray-600">
              スマートフォンでQRコードを読み取り、
            </p>
            <p className="text-sm text-gray-600">
              GitHubアカウントでログインしてください
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              linkStatus === 'waiting' ? 'bg-yellow-500' :
              linkStatus === 'linked' ? 'bg-blue-500' : 'bg-green-500'
            }`} />
            <span className="text-sm">
              {linkStatus === 'waiting' && 'ログイン待機中...'}
              {linkStatus === 'linked' && 'ログイン完了 - カードをタッチしてください'}
              {linkStatus === 'done' && '連携完了！'}
            </span>
          </div>
        </div>
      )}
      
      <div className="flex space-x-4 mt-6">
        <button 
          className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
          onClick={() => {
            // ダッシュボードに戻る
            window.location.href = '/dashboard';
          }}
        >
          キャンセル
        </button>
        
        <button 
          className={`px-4 py-2 rounded ${
            linkStatus === 'done' 
              ? 'bg-blue-500 text-white hover:bg-blue-600' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          disabled={linkStatus !== 'done'}
          onClick={() => {
            // 完了処理
            window.location.href = '/dashboard';
          }}
        >
          完了
        </button>
      </div>
    </div>
  );
};
