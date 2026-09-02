'use client';

import { useState, useEffect } from 'react';
import { EVENT_CONFIG } from '../config/eventConfig';

type ViewState = 'loading' | 'home' | 'form' | 'confirm' | 'complete' | 'search' | 'ticket';

interface Reservation {
  token?: string;
  id: number;
  name: string;
  category: string;
  participant_count: number;
  checked_in: number;
  checked_in_at: string | null;
  created_at: string;
  reservation_code: string;
}

interface EventState {
  title: string;
  capacity: number;
  reserved_count: number;
  is_accepting: number;
  event_date: string;
  event_location: string;
  reservation_end: string;
  duplicate_mode: string;
}

export default function Page() {
  const [view, setView] = useState<ViewState>('loading');
  const [event, setEvent] = useState<EventState | null>(null);
  
  // Local storage tokens
  const [savedReservations, setSavedReservations] = useState<Reservation[]>([]);
  const [selectedResIndex, setSelectedResIndex] = useState<number>(0);
  
  // Form input states
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [participantCount, setParticipantCount] = useState('1');
  const [discoverySource, setDiscoverySource] = useState('');
  const [discoverySourceOther, setDiscoverySourceOther] = useState('');
  const [requestedEvent, setRequestedEvent] = useState('');
  const [consent, setConsent] = useState(false);
  
  // Override flag for duplicate check warnings (Mode B)
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  
  // Search state
  const [searchName, setSearchName] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  
  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Fetch event info on mount and validate existing tokens
  useEffect(() => {
    fetchEventInfo();
  }, []);
  
  const fetchEventInfo = async () => {
    try {
      const res = await fetch(`${EVENT_CONFIG.apiUrl}/api/event`);
      if (res.ok) {
        const data = await res.json();
        setEvent(data);
        // Once event info is fetched, validate stored tokens
        await checkStoredTokens();
      } else {
        // Fallback using local config if API fails
        setEvent({
          title: EVENT_CONFIG.title,
          capacity: 200,
          reserved_count: 0,
          is_accepting: 1,
          event_date: `${EVENT_CONFIG.date} ${EVENT_CONFIG.time}`,
          event_location: EVENT_CONFIG.location,
          reservation_end: "",
          duplicate_mode: 'A'
        });
        setView('home');
      }
    } catch (err) {
      console.error("API error, using config fallback:", err);
      setEvent({
        title: EVENT_CONFIG.title,
        capacity: 200,
        reserved_count: 0,
        is_accepting: 1,
        event_date: `${EVENT_CONFIG.date} ${EVENT_CONFIG.time}`,
        event_location: EVENT_CONFIG.location,
        reservation_end: "",
        duplicate_mode: 'A'
      });
      setView('home');
    }
  };
  
  const checkStoredTokens = async () => {
    try {
      const stored = localStorage.getItem('reservation_access_tokens');
      if (stored) {
        const tokens: string[] = JSON.parse(stored);
        if (tokens.length > 0) {
          const res = await fetch(`${EVENT_CONFIG.apiUrl}/api/reservations/tokens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokens })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.reservations && data.reservations.length > 0) {
              setSavedReservations(data.reservations);
              setSelectedResIndex(0);
              setView('ticket');
              return;
            }
          }
        }
      }
      setView('home');
    } catch (e) {
      console.error("Failed to fetch token statuses:", e);
      setView('home');
    }
  };
  
  // Add a newly retrieved token to local storage
  const saveTokenToStorage = (token: string) => {
    try {
      const stored = localStorage.getItem('reservation_access_tokens');
      const tokens: string[] = stored ? JSON.parse(stored) : [];
      if (!tokens.includes(token)) {
        tokens.push(token);
        localStorage.setItem('reservation_access_tokens', JSON.stringify(tokens));
      }
    } catch (e) {
      console.error("Failed to save token to localStorage:", e);
    }
  };
  
  // Validation logic
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!email.trim()) {
      newErrors.email = 'メールアドレスを入力してください。';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = '正しいメールアドレスの形式で入力してください。';
    }
    
    if (!name.trim()) {
      newErrors.name = 'お名前を入力してください。';
    } else if (name.trim().length < 2) {
      newErrors.name = 'お名前は2文字以上で入力してください。';
    } else if (name.trim().length > 50) {
      newErrors.name = 'お名前は50文字以内で入力してください。';
    }
    
    if (!category) {
      newErrors.category = '該当区分を選択してください。';
    }
    
    if (!discoverySource) {
      newErrors.discoverySource = 'きっかけを選択してください。';
    } else if (discoverySource === 'その他' && !discoverySourceOther.trim()) {
      newErrors.discoverySourceOther = '具体的なきっかけを入力してください。';
    }
    
    if (requestedEvent && requestedEvent.length > 500) {
      newErrors.requestedEvent = '今後開催してほしいイベントは500文字以内で入力してください。';
    }
    
    if (!consent) {
      newErrors.consent = '個人情報の取り扱いへの同意が必要です。';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    if (validateForm()) {
      setView('confirm');
    }
  };
  
  const handleRegister = async (forceOverride = false) => {
    setIsSubmitting(true);
    setApiError(null);
    
    try {
      const payload = {
        email: email.trim(),
        name: name.trim(),
        category,
        participant_count: parseInt(participantCount, 10),
        discovery_source: discoverySource,
        discovery_source_other: discoverySource === 'その他' ? discoverySourceOther.trim() : null,
        requested_event: requestedEvent.trim() || null,
        force: forceOverride
      };
      
      const res = await fetch(`${EVENT_CONFIG.apiUrl}/api/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Success
        saveTokenToStorage(data.token);
        // Refresh event details
        await fetchEventInfo();
        setView('complete');
        // Clear form
        clearForm();
      } else {
        // Handle custom errors
        if (data.error === 'DuplicateEmail') {
          setApiError('DuplicateEmail');
        } else if (data.error === 'DuplicateWarning') {
          setWarningMessage(data.message || 'このメールアドレスは既に登録されています。追加で予約を登録しますか？');
          setShowDuplicateWarning(true);
        } else {
          setApiError(data.message || '予約の登録に失敗しました。');
        }
      }
    } catch (err) {
      console.error(err);
      setApiError('サーバーと通信できませんでした。電波状況をご確認ください。');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const clearForm = () => {
    setEmail('');
    setName('');
    setCategory('');
    setParticipantCount('1');
    setDiscoverySource('');
    setDiscoverySourceOther('');
    setRequestedEvent('');
    setConsent(false);
    setShowDuplicateWarning(false);
  };
  
  // Search Reservation
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    setErrors({});
    
    if (!searchName.trim() || !searchEmail.trim()) {
      setErrors({ search: 'お名前とメールアドレスの両方を入力してください。' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch(`${EVENT_CONFIG.apiUrl}/api/reservations/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: searchName.trim(),
          email: searchEmail.trim()
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Save new token and switch view
        saveTokenToStorage(data.token);
        // Refresh token list
        await checkStoredTokens();
      } else {
        setApiError(data.message || '予約が見つかりませんでした。入力内容をお確かめください。');
      }
    } catch (err) {
      console.error(err);
      setApiError('通信エラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const currentTicket = savedReservations[selectedResIndex];
  
  return (
    <div>
      {/* Hero visual */}
      <div className="hero">
        <div className="hero-overlay">
          <h1 className="hero-title" aria-label="大阪産業大学 ホームカミングデー 付属高校吹奏部演奏会">
            <span className="hero-title-line">大阪産業大学</span>
            <span className="hero-title-line">♪ホームカミングデー♪</span>
            <span className="hero-title-line">付属高校吹奏部演奏会</span>
          </h1>
          <p className="hero-subtitle">お申し込み受付</p>
        </div>
      </div>
      
      <div className="container">
        
        {/* VIEW 1: LOADING */}
        {view === 'loading' && (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ fontSize: '20px', fontWeight: 'bold' }}>読み込み中...</p>
            <p style={{ color: '#666', marginTop: '10px' }}>しばらくお待ちください。</p>
          </div>
        )}
        
        {/* VIEW 2: HOME (Tokens not found, event info shown) */}
        {view === 'home' && (
          <div className="card">
            <h2>演奏会のご案内</h2>
            <div className="info-box event-info-box">
              <div className="event-info-item">
                <strong>開催日</strong>
                <span>{EVENT_CONFIG.date}</span>
              </div>
              <div className="event-info-item event-info-time">
                <strong>時間</strong>
                <span>
                  {EVENT_CONFIG.time}
                  <span style={{ display: 'block', marginTop: '6px', color: 'var(--color-error)', fontWeight: 'bold', fontSize: '14px', lineHeight: 1.5 }}>
                    {EVENT_CONFIG.timeNotice}
                  </span>
                </span>
              </div>
              <div className="event-info-item event-info-location">
                <strong>開催場所</strong>
                <span>{event?.event_location || EVENT_CONFIG.location}</span>
              </div>
            </div>
            
            <p className="intro-heading">
              {EVENT_CONFIG.introTitleLines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </p>
            <p className="intro-text">
              {EVENT_CONFIG.introText}
            </p>
            
            <div className="info-box" style={{ backgroundColor: '#FFF9C4', borderColor: '#FBC02D' }}>
              <strong>注意事項:</strong>
              <ul>
                <li style={{ marginBottom: '6px', color: 'var(--color-error)', fontWeight: 'bold' }}>
                  {EVENT_CONFIG.timeChangeNote}
                </li>
                {EVENT_CONFIG.notes.map((note, idx) => (
                  <li key={idx} style={{ marginBottom: '6px' }}>{note}</li>
                ))}
              </ul>
            </div>
            
            {event?.is_accepting === 0 ? (
              <div className="info-box" style={{ backgroundColor: '#FFCDD2', borderColor: '#D32F2F', color: '#B71C1C', fontWeight: 'bold', textAlign: 'center' }}>
                ただいま、インターネットからの予約受付は停止しております。
              </div>
            ) : event && event.reserved_count >= event.capacity ? (
              <div className="info-box" style={{ backgroundColor: '#FFCDD2', borderColor: '#D32F2F', color: '#B71C1C', fontWeight: 'bold', textAlign: 'center' }}>
                定員（200名）に達したため、予約受付を終了いたしました。
              </div>
            ) : null}
            
            <div className="btn-group" style={{ marginTop: '32px' }}>
              <button 
                className="btn btn-accent" 
                onClick={() => setView('form')}
                disabled={event?.is_accepting === 0 || (event ? event.reserved_count >= event.capacity : false)}
              >
                新規予約を申し込む
              </button>
              <button className="btn btn-outline" onClick={() => { setApiError(null); setErrors({}); setView('search'); }}>
                自分の予約内容を確認する
              </button>
            </div>
          </div>
        )}
        
        {/* VIEW 3: FORM */}
        {view === 'form' && (
          <div className="card">
            <h2>予約情報の入力</h2>
            <p style={{ color: '#555', marginBottom: '24px' }}>※すべての項目を正確にご入力ください。</p>
            
            {apiError && (
              <div className="info-box" style={{ backgroundColor: '#FFCDD2', borderColor: '#D32F2F', color: '#B71C1C', fontWeight: 'bold', marginBottom: '24px' }}>
                {apiError}
              </div>
            )}
            
            <form onSubmit={handleProceedToConfirm}>
              
              {/* Email */}
              <div className="form-group">
                <label className="form-label" htmlFor="email">
                  メールアドレス
                  <span className="badge-required">必須</span>
                </label>
                <input
                  type="email"
                  id="email"
                  className="form-control"
                  placeholder="example@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {errors.email && <div className="error-message">{errors.email}</div>}
              </div>
              
              {/* Name */}
              <div className="form-group">
                <label className="form-label" htmlFor="name">
                  お名前
                  <span className="badge-required">必須</span>
                </label>
                <input
                  type="text"
                  id="name"
                  className="form-control"
                  placeholder="山田 太郎"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {errors.name && <div className="error-message">{errors.name}</div>}
              </div>
              
              {/* Category */}
              <div className="form-group">
                <label className="form-label">
                  該当区分
                  <span className="badge-required">必須</span>
                </label>
                <div className="radio-group">
                  {[
                    '卒業生',
                    '在学生',
                    '教員・職員',
                    '一般',
                    '大阪産業大学付属高校吹奏部関係者'
                  ].map((cat) => (
                    <label key={cat} className="radio-label" style={{ borderColor: category === cat ? 'var(--color-primary)' : '#CCCCCC', backgroundColor: category === cat ? '#E8F0FE' : '#FAFBFD' }}>
                      <input
                        type="radio"
                        name="category"
                        className="radio-input"
                        checked={category === cat}
                        onChange={() => setCategory(cat)}
                      />
                      {cat}
                    </label>
                  ))}
                </div>
                {errors.category && <div className="error-message">{errors.category}</div>}
              </div>
              
              {/* Participant Count */}
              <div className="form-group">
                <label className="form-label">
                  申し込み人数
                  <span className="badge-required">必須</span>
                </label>
                <div className="participant-count-grid">
                  {['1', '2', '3', '4'].map((cnt) => (
                    <label key={cnt} className="radio-label participant-count-option" style={{ borderColor: participantCount === cnt ? 'var(--color-primary)' : '#CCCCCC', backgroundColor: participantCount === cnt ? '#E8F0FE' : '#FAFBFD' }}>
                      <input
                        type="radio"
                        name="participantCount"
                        className="radio-input"
                        checked={participantCount === cnt}
                        onChange={() => setParticipantCount(cnt)}
                      />
                      {cnt}名
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Discovery Source */}
              <div className="form-group">
                <label className="form-label">
                  今回のイベントを知ったきっかけ
                  <span className="badge-required">必須</span>
                </label>
                <div className="radio-group">
                  {[
                    '校友会会報「凡友」',
                    '校友会Webサイト',
                    '学内掲示物（ポスター・サイネージ）',
                    '知り合いからの情報',
                    'その他'
                  ].map((src) => (
                    <label key={src} className="radio-label" style={{ borderColor: discoverySource === src ? 'var(--color-primary)' : '#CCCCCC', backgroundColor: discoverySource === src ? '#E8F0FE' : '#FAFBFD' }}>
                      <input
                        type="radio"
                        name="discoverySource"
                        className="radio-input"
                        checked={discoverySource === src}
                        onChange={() => setDiscoverySource(src)}
                      />
                      {src}
                    </label>
                  ))}
                </div>
                {errors.discoverySource && <div className="error-message">{errors.discoverySource}</div>}
                
                {discoverySource === 'その他' && (
                  <div style={{ marginTop: '12px' }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="具体的なきっかけをご記入ください"
                      value={discoverySourceOther}
                      onChange={(e) => setDiscoverySourceOther(e.target.value)}
                    />
                    {errors.discoverySourceOther && <div className="error-message">{errors.discoverySourceOther}</div>}
                  </div>
                )}
              </div>
              
              {/* Future Events Requests */}
              <div className="form-group">
                <label className="form-label" htmlFor="requestedEvent">
                  今後開催してほしいイベント
                  <span className="badge-optional">任意</span>
                </label>
                <textarea
                  id="requestedEvent"
                  className="form-control"
                  placeholder="例：OBによる定期演奏会、懇親イベントなど（500文字以内）"
                  value={requestedEvent}
                  onChange={(e) => setRequestedEvent(e.target.value)}
                />
                {errors.requestedEvent && <div className="error-message">{errors.requestedEvent}</div>}
              </div>
              
              {/* Privacy Consent */}
              <div className="privacy-box" style={{ whiteSpace: 'pre-wrap' }}>
                {EVENT_CONFIG.privacyStatement}
              </div>
              
              <div className="form-group">
                <label className="checkbox-label" style={{ borderColor: consent ? 'var(--color-primary)' : '#CCCCCC', backgroundColor: consent ? '#E8F0FE' : '#FAFBFD' }}>
                  <input
                    type="checkbox"
                    className="checkbox-input"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  個人情報の取り扱いについて確認し、同意します。
                </label>
                {errors.consent && <div className="error-message">{errors.consent}</div>}
              </div>
              
              <div className="btn-group btn-group-row">
                <button type="submit" className="btn btn-accent">
                  入力内容を確認する
                </button>
                <button type="button" className="btn btn-outline" onClick={() => { clearForm(); setView('home'); }}>
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        )}
        
        {/* VIEW 4: CONFIRMATION */}
        {view === 'confirm' && (
          <div className="card">
            <h2>入力内容の確認</h2>
            <p style={{ color: '#555', marginBottom: '24px' }}>下記の内容で予約を完了します。お間違いがなければ「この内容で申し込む」ボタンを押してください。</p>
            
            {apiError && (
              <div className="info-box" style={{ backgroundColor: '#FFCDD2', borderColor: '#D32F2F', color: '#B71C1C', fontWeight: 'bold' }}>
                {apiError === 'DuplicateEmail' ? (
                  <div>
                    このメールアドレスは既に予約されています。<br />
                    <button 
                      className="btn btn-accent" 
                      style={{ height: '40px', fontSize: '16px', marginTop: '12px' }}
                      onClick={() => {
                        setSearchEmail(email);
                        setSearchName(name);
                        setApiError(null);
                        setView('search');
                      }}
                    >
                      予約確認画面へ移動する
                    </button>
                  </div>
                ) : (
                  apiError
                )}
              </div>
            )}
            
            {showDuplicateWarning && (
              <div className="info-box" style={{ backgroundColor: '#FFF9C4', borderColor: '#FBC02D', color: '#F57F17' }}>
                <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>⚠️ 重複警告</p>
                <p>{warningMessage}</p>
                <div className="confirm-warning-actions">
                  <button 
                    className="btn btn-accent" 
                    style={{ height: '40px', fontSize: '16px' }}
                    onClick={() => handleRegister(true)}
                    disabled={isSubmitting}
                  >
                    はい、このまま予約する
                  </button>
                  <button 
                    className="btn btn-outline" 
                    style={{ height: '40px', fontSize: '16px', backgroundColor: 'white' }}
                    onClick={() => setShowDuplicateWarning(false)}
                  >
                    いいえ、修正する
                  </button>
                </div>
              </div>
            )}
            
            <div className="ticket" style={{ borderStyle: 'solid', borderWidth: '1px', borderColor: '#CCC' }}>
              <div className="ticket-row ticket-row-stack ticket-row-email">
                <span className="ticket-label">メールアドレス</span>
                <span className="ticket-value">{email}</span>
              </div>
              <div className="ticket-row">
                <span className="ticket-label">お名前</span>
                <span className="ticket-value">{name}</span>
              </div>
              <div className="ticket-row">
                <span className="ticket-label">該当区分</span>
                <span className="ticket-value">{category}</span>
              </div>
              <div className="ticket-row">
                <span className="ticket-label">申し込み人数</span>
                <span className="ticket-value">{participantCount}名</span>
              </div>
              <div className="ticket-row ticket-row-stack">
                <span className="ticket-label">知ったきっかけ</span>
                <span className="ticket-value">
                  {discoverySource === 'その他' ? `その他（${discoverySourceOther}）` : discoverySource}
                </span>
              </div>
              {requestedEvent && (
                <div className="ticket-row ticket-row-stack">
                  <span className="ticket-label">今後希望するイベント</span>
                  <span className="ticket-value">{requestedEvent}</span>
                </div>
              )}
            </div>
            
            {!showDuplicateWarning && (
              <div className="btn-group btn-group-row">
                <button 
                  type="button" 
                  className="btn btn-accent" 
                  onClick={() => handleRegister(false)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '登録中...' : 'この内容で申し込む'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  onClick={() => setView('form')}
                  disabled={isSubmitting}
                >
                  入力内容を修正する
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* VIEW 5: COMPLETE */}
        {view === 'complete' && (
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '64px', color: 'var(--color-success)', marginBottom: '16px' }}>✓</div>
            <h2>お申し込みが完了しました</h2>
            <div className="info-box" style={{ textAlign: 'left', marginTop: '24px', backgroundColor: '#E8F5E9', borderColor: 'var(--color-success)' }}>
              <p style={{ fontWeight: 'bold', fontSize: '18px', color: 'var(--color-success)', marginBottom: '8px' }}>
                受付方法のご案内
              </p>
              <p style={{ fontSize: '16px' }}>
                当日は受付場所に設置されたQRコードを読み取り、この端末で予約内容を表示してください。<br />
                同じスマートフォン・ブラウザで開いた場合は、予約確認内容が自動的に表示されます。
              </p>
            </div>
            
            <button className="btn btn-primary" style={{ marginTop: '24px' }} onClick={checkStoredTokens}>
              予約確認画面を表示する
            </button>
          </div>
        )}
        
        {/* VIEW 6: SEARCH */}
        {view === 'search' && (
          <div className="card">
            <h2>予約内容の確認・検索</h2>
            <p style={{ color: '#555', marginBottom: '24px' }}>
              予約時にご登録いただいた「お名前」と「メールアドレス」を入力し、「検索する」ボタンを押してください。
            </p>
            
            {apiError && (
              <div className="info-box" style={{ backgroundColor: '#FFCDD2', borderColor: '#D32F2F', color: '#B71C1C', fontWeight: 'bold' }}>
                {apiError}
              </div>
            )}
            
            <form onSubmit={handleSearch}>
              <div className="form-group">
                <label className="form-label" htmlFor="searchName">お名前</label>
                <input
                  type="text"
                  id="searchName"
                  className="form-control"
                  placeholder="山田 太郎"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label" htmlFor="searchEmail">メールアドレス</label>
                <input
                  type="email"
                  id="searchEmail"
                  className="form-control"
                  placeholder="example@example.com"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                />
                {errors.search && <div className="error-message">{errors.search}</div>}
              </div>
              
              <div className="btn-group btn-group-row">
                <button type="submit" className="btn btn-accent" disabled={isSubmitting}>
                  {isSubmitting ? '検索中...' : '検索する'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setView(savedReservations.length > 0 ? 'ticket' : 'home')}>
                  戻る
                </button>
              </div>
            </form>
          </div>
        )}
        
        {/* VIEW 7: TICKET (Reservation View / Reception View) */}
        {view === 'ticket' && currentTicket && (
          <div>
            <div className="card" style={{ padding: '20px 16px' }}>
              {/* Dropdown if multiple reservations are stored */}
              {savedReservations.length > 1 && (
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontSize: '16px' }} htmlFor="resSelector">表示する予約を切り替え</label>
                  <select 
                    id="resSelector"
                    className="form-control" 
                    value={selectedResIndex}
                    onChange={(e) => setSelectedResIndex(parseInt(e.target.value, 10))}
                  >
                    {savedReservations.map((res, index) => (
                      <option key={res.id} value={index}>
                        {res.name} 様 ({res.participant_count}名)
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="ticket">
                <div className="ticket-header">
                  <div className={`ticket-status ${currentTicket.checked_in ? 'checked-in' : ''}`}>
                    {currentTicket.checked_in ? '受付済み' : 'お申し込みありがとうございます。'}
                  </div>
                  <div style={{ fontSize: '15px', color: '#666', marginTop: '6px' }}>
                    {currentTicket.checked_in ? '当日の受付手続きは完了しています。' : '当日、受付担当者にこの画面を見せてください。'}
                  </div>
                </div>
                
                <div className="ticket-row">
                  <span className="ticket-label">お名前</span>
                  <span className="ticket-value large">{currentTicket.name} 様</span>
                </div>
                
                <div className="ticket-row">
                  <span className="ticket-label">申し込み人数</span>
                  <span className="ticket-value large">{currentTicket.participant_count} 名</span>
                </div>
                
                <div className="ticket-row">
                  <span className="ticket-label">該当区分</span>
                  <span className="ticket-value">{currentTicket.category}</span>
                </div>
                
                <div className="ticket-row">
                  <span className="ticket-label">予約番号</span>
                  <span className="ticket-value" style={{ fontFamily: 'monospace', letterSpacing: '1px' }}>{currentTicket.reservation_code}</span>
                </div>
                
                {currentTicket.checked_in === 1 && currentTicket.checked_in_at && (
                  <div className="ticket-row">
                    <span className="ticket-label">受付日時</span>
                    <span className="ticket-value">
                      {new Date(currentTicket.checked_in_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="btn-group">
                <button 
                  className="btn btn-accent" 
                  onClick={() => {
                    clearForm();
                    setView('form');
                  }}
                  disabled={event?.is_accepting === 0 || (event ? event.reserved_count >= event.capacity : false)}
                >
                  別の方の予約を申し込む
                </button>
                <button 
                  className="btn btn-outline" 
                  onClick={() => {
                    setApiError(null);
                    setErrors({});
                    setSearchName('');
                    setSearchEmail('');
                    setView('search');
                  }}
                >
                  別の予約を検索・追加する
                </button>
              </div>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}
