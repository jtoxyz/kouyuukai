'use client';

import { useState, useEffect } from 'react';
import { EVENT_CONFIG } from '../../config/eventConfig';
import ExcelJS from 'exceljs';

type SortOrder = 'name' | 'date';

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  
  // Dashboard states
  const [summary, setSummary] = useState<{
    capacity: number;
    reserved_count: number;
    remaining: number;
    total_reservations: number;
    checked_in_count: number;
    is_accepting: number;
  } | null>(null);
  
  const [reservations, setReservations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected reservation for details modal
  const [selectedResDetail, setSelectedResDetail] = useState<any | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  
  // Excel generation options
  const [sortOrder, setSortOrder] = useState<SortOrder>('name');
  
  const [isActionPending, setIsActionPending] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  
  // Check login state on mount by attempting to fetch summary
  useEffect(() => {
    fetchSummaryAndList();
  }, []);
  
  const fetchSummaryAndList = async () => {
    try {
      const resSum = await fetch(`${EVENT_CONFIG.apiUrl}/api/admin/summary`, { credentials: 'include' });
      if (resSum.ok) {
        const sumData = await resSum.json();
        setSummary(sumData);
        setIsLoggedIn(true);
        
        // Fetch list
        fetchReservationsList();
      } else if (resSum.status === 401) {
        setIsLoggedIn(false);
      } else {
        setApiError('データ取得に失敗しました。');
      }
    } catch (e) {
      console.error(e);
      setApiError('サーバーと接続できません。');
      setIsLoggedIn(false);
    }
  };
  
  const fetchReservationsList = async (query = searchQuery) => {
    try {
      const url = query ? `${EVENT_CONFIG.apiUrl}/api/admin/reservations?search=${encodeURIComponent(query)}` : `${EVENT_CONFIG.apiUrl}/api/admin/reservations`;
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setReservations(data.reservations || []);
      }
    } catch (e) {
      console.error(e);
    }
  };
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch(`${EVENT_CONFIG.apiUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'include'
      });
      if (res.ok) {
        setIsLoggedIn(true);
        fetchSummaryAndList();
      } else {
        const data = await res.json();
        setLoginError(data.message || 'ログインに失敗しました。');
      }
    } catch (e) {
      setLoginError('通信エラーが発生しました。');
    }
  };
  
  const handleLogout = async () => {
    try {
      await fetch(`${EVENT_CONFIG.apiUrl}/api/admin/logout`, { method: 'POST', credentials: 'include' });
      setIsLoggedIn(false);
      setSummary(null);
      setReservations([]);
    } catch (e) {
      console.error(e);
    }
  };
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    fetchReservationsList(val);
  };
  
  const handleViewDetail = async (id: number) => {
    try {
      const res = await fetch(`${EVENT_CONFIG.apiUrl}/api/admin/reservations/${id}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSelectedResDetail(data.reservation);
        setDetailModalOpen(true);
      } else {
        alert('詳細情報の取得に失敗しました。');
      }
    } catch (e) {
      console.error(e);
    }
  };
  
  const handleToggleCheckin = async (id: number, currentStatus: number) => {
    setIsActionPending(true);
    try {
      const res = await fetch(`${EVENT_CONFIG.apiUrl}/api/admin/reservations/${id}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked_in: currentStatus === 1 ? 0 : 1 }),
        credentials: 'include'
      });
      if (res.ok) {
        // Refresh details if modal is open
        if (selectedResDetail && selectedResDetail.id === id) {
          const updatedDetailRes = await fetch(`${EVENT_CONFIG.apiUrl}/api/admin/reservations/${id}`, { credentials: 'include' });
          if (updatedDetailRes.ok) {
            const data = await updatedDetailRes.json();
            setSelectedResDetail(data.reservation);
          }
        }
        await fetchSummaryAndList();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionPending(false);
    }
  };
  
  const handleCancelReservation = async (id: number) => {
    if (!confirm('この予約をキャンセルしてもよろしいですか？\n(キャンセルすると定員枠が解放されます)')) {
      return;
    }
    
    setIsActionPending(true);
    try {
      const res = await fetch(`${EVENT_CONFIG.apiUrl}/api/admin/reservations/${id}/cancel`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        setDetailModalOpen(false);
        setSelectedResDetail(null);
        await fetchSummaryAndList();
      } else {
        const data = await res.json();
        alert(data.message || 'キャンセルに失敗しました。');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionPending(false);
    }
  };
  
  const handleToggleAccepting = async () => {
    if (!summary) return;
    const nextAccepting = summary.is_accepting === 1 ? 0 : 1;
    const label = nextAccepting === 1 ? '開始' : '停止';
    if (!confirm(`予約受付を${label}してもよろしいですか？`)) {
      return;
    }
    
    setIsActionPending(true);
    try {
      const res = await fetch(`${EVENT_CONFIG.apiUrl}/api/admin/event/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_accepting: nextAccepting }),
        credentials: 'include'
      });
      if (res.ok) {
        await fetchSummaryAndList();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionPending(false);
    }
  };
  
  // Fetch unmasked lists for exporting Excel
  const fetchAllForExport = async (): Promise<any[]> => {
    try {
      const res = await fetch(`${EVENT_CONFIG.apiUrl}/api/admin/reservations/export`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        return data.reservations || [];
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  };
  
  // ==========================================
  // EXCEL EXPORTS
  // ==========================================
  
  // A. Export Reception Registry (印刷・手書き用)
  const exportReceptionRegistry = async () => {
    setIsActionPending(true);
    const data = await fetchAllForExport();
    
    // Filter active only
    let active = data.filter(r => !r.cancelled_at);
    
    // Sort
    if (sortOrder === 'name') {
      active.sort((a, b) => a.name.localeCompare(b.name, 'ja-JP'));
    } else {
      active.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('受付用予約者リスト');
    
    // Page Setup for A4 Landscape
    worksheet.pageSetup = {
      orientation: 'landscape',
      paperSize: 9, // A4
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
      printTitlesRow: '1:2', // repeat title and headers on every page
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    };
    
    // 1. Title Block
    worksheet.mergeCells('A1:E1');
    const titleRow = worksheet.getRow(1);
    titleRow.getCell(1).value = `ホームカミングデー 大産大学高校吹奏楽部演奏会 受付用予約者リスト  (印刷日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })})`;
    titleRow.getCell(1).font = { name: 'Meiryo', size: 14, bold: true };
    titleRow.height = 30;
    titleRow.alignment = { vertical: 'middle' };
    
    // 2. Table Headers
    const headers = ['No.', '氏名', '該当区分', '人数', '受付チェック欄 (当日はここに記入してください)'];
    worksheet.getRow(2).values = headers;
    worksheet.getRow(2).height = 25;
    
    // Style headers
    worksheet.getRow(2).eachCell((cell) => {
      cell.font = { name: 'Meiryo', size: 12, bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' } // Light gray header background
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'medium' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' }
      };
    });
    
    // 3. Data insertion
    let currentNo = 1;
    active.forEach((res) => {
      const row = worksheet.addRow([
        currentNo++,
        `${res.name} 様`,
        res.category,
        `${res.participant_count}名`,
        res.checked_in === 1 ? '【受付済】' : '' // Write check if already checked in, else leave space for hand-writing
      ]);
      row.height = 36; // Tall row height for hand-writing
      
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Meiryo', size: 12 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 1 || colNumber === 4 ? 'center' : 'left'
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
    
    // Set explicit column widths
    worksheet.getColumn(1).width = 6;   // No.
    worksheet.getColumn(2).width = 25;  // Name
    worksheet.getColumn(3).width = 20;  // Category
    worksheet.getColumn(4).width = 10;  // Count
    worksheet.getColumn(5).width = 45;  // Check column
    
    // Header/Footer page numbers
    worksheet.headerFooter.oddFooter = 'ページ &P / &N';
    
    // Generate buffer & trigger download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reception_registry_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
    setIsActionPending(false);
  };
  
  // B. Export Admin Archive (管理保存用)
  const exportAdminArchive = async () => {
    setIsActionPending(true);
    const data = await fetchAllForExport();
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('全予約レコード');
    
    // Frozen first row & Auto Filter
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.autoFilter = 'A1:M1';
    
    // Headers
    const headers = [
      'No.', '予約番号', '氏名', 'メールアドレス', '区分', '人数',
      '知ったきっかけ', 'その他のきっかけ', '今後開催してほしいイベント',
      '申込日時', '受付状態', '受付日時', 'キャンセル状態'
    ];
    
    const headerRow = worksheet.addRow(headers);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Meiryo', bold: true, size: 12 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD6E4F0' } // Soft blue header
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    
    let currentNo = 1;
    data.forEach(res => {
      const row = worksheet.addRow([
        currentNo++,
        res.reservation_code,
        res.name,
        res.email,
        res.category,
        res.participant_count,
        res.discovery_source,
        res.discovery_source_other || '',
        res.requested_event || '',
        res.created_at ? new Date(res.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '',
        res.checked_in === 1 ? '受付済' : '未受付',
        res.checked_in_at ? new Date(res.checked_in_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '',
        res.cancelled_at ? `キャンセル済 (${new Date(res.cancelled_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })})` : '有効'
      ]);
      row.height = 20;
      
      // Styling cell borders and alignment
      row.eachCell((cell, colIndex) => {
        cell.font = { name: 'Meiryo', size: 11 };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        // Wrap text for requested event
        if (colIndex === 9) {
          cell.alignment = { wrapText: true, vertical: 'middle' };
        } else {
          cell.alignment = { vertical: 'middle' };
        }
      });
    });
    
    // Set auto-fit widths (approximate characters)
    worksheet.getColumn(1).width = 6;   // No.
    worksheet.getColumn(2).width = 12;  // Code
    worksheet.getColumn(3).width = 20;  // Name
    worksheet.getColumn(4).width = 30;  // Email
    worksheet.getColumn(5).width = 20;  // Category
    worksheet.getColumn(6).width = 8;   // Count
    worksheet.getColumn(7).width = 25;  // Source
    worksheet.getColumn(8).width = 25;  // Source Other
    worksheet.getColumn(9).width = 40;  // Requested Event
    worksheet.getColumn(10).width = 22; // Created At
    worksheet.getColumn(11).width = 12; // Check-in Status
    worksheet.getColumn(12).width = 22; // Check-in At
    worksheet.getColumn(13).width = 30; // Cancel Status
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `homecoming_reservations_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
    setIsActionPending(false);
  };
  
  if (isLoggedIn === null) {
    return (
      <div className="container" style={{ paddingTop: '60px' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <p>管理者認証チェック中...</p>
        </div>
      </div>
    );
  }
  
  // ==========================================
  // VIEW: LOGIN FORM
  // ==========================================
  if (!isLoggedIn) {
    return (
      <div className="container" style={{ paddingTop: '60px' }}>
        <div className="card" style={{ maxWidth: '480px', margin: '0 auto' }}>
          <h2>管理者ログイン</h2>
          <p style={{ fontSize: '15px', color: '#555', marginBottom: '24px' }}>
            管理画面へ進むには、管理パスワードを入力してください。
          </p>
          
          {loginError && (
            <div className="info-box" style={{ backgroundColor: '#FFCDD2', borderColor: '#D32F2F', color: '#B71C1C', fontWeight: 'bold' }}>
              {loginError}
            </div>
          )}
          
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="adminPass">パスワード</label>
              <input
                type="password"
                id="adminPass"
                className="form-control"
                placeholder="パスワードを入力"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            <button type="submit" className="btn btn-accent">
              ログインする
            </button>
          </form>
        </div>
      </div>
    );
  }
  
  // ==========================================
  // VIEW: DASHBOARD
  // ==========================================
  return (
    <div className="container" style={{ maxWidth: '960px', paddingBottom: '100px' }}>
      
      {/* Admin Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: 'var(--color-primary)' }}>管理者ダッシュボード</h1>
          <p style={{ fontSize: '14px', color: '#666' }}>試作版運用確認用画面</p>
        </div>
        <button className="btn btn-outline" style={{ width: 'auto', height: '40px', fontSize: '15px' }} onClick={handleLogout}>
          ログアウト
        </button>
      </div>
      
      {apiError && (
        <div className="info-box" style={{ backgroundColor: '#FFCDD2', borderColor: '#D32F2F', color: '#B71C1C', fontWeight: 'bold' }}>
          {apiError}
        </div>
      )}
      
      {/* Stats Summary */}
      {summary && (
        <div className="card" style={{ marginBottom: '32px' }}>
          <h2>予約ステータス</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">総定員</div>
              <div className="stat-val">{summary.capacity}名</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">予約合計人数</div>
              <div className="stat-val" style={{ color: summary.reserved_count >= summary.capacity ? 'var(--color-error)' : 'var(--color-primary)' }}>
                {summary.reserved_count}名
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">残り人数</div>
              <div className="stat-val">{summary.remaining}名</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">予約件数</div>
              <div className="stat-val">{summary.total_reservations}件</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">受付済み</div>
              <div className="stat-val" style={{ color: 'var(--color-success)' }}>{summary.checked_in_count}件</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#F8F9FA', padding: '16px', borderRadius: '8px', border: '1px solid #DDD' }}>
            <span style={{ fontWeight: 'bold' }}>現在の予約受付状態: </span>
            <span style={{ 
              fontWeight: 'bold', 
              color: summary.is_accepting === 1 ? 'var(--color-success)' : 'var(--color-error)',
              backgroundColor: summary.is_accepting === 1 ? '#E8F5E9' : '#FFCDD2',
              padding: '4px 12px',
              borderRadius: '4px'
            }}>
              {summary.is_accepting === 1 ? '受付中' : '停止中'}
            </span>
            <button 
              className={`btn ${summary.is_accepting === 1 ? 'btn-outline' : 'btn-accent'}`} 
              style={{ width: 'auto', height: '36px', fontSize: '14px', padding: '0 16px', marginLeft: 'auto' }}
              onClick={handleToggleAccepting}
              disabled={isActionPending}
            >
              {summary.is_accepting === 1 ? '予約受付を停止する' : '予約受付を開始する'}
            </button>
          </div>
        </div>
      )}
      
      {/* Excel Exports Settings */}
      <div className="card" style={{ marginBottom: '32px' }}>
        <h2>予約者データ出力 (Excel)</h2>
        <p style={{ fontSize: '15px', color: '#555', marginBottom: '16px' }}>
          ダウンロードしたエクセルファイルはそのままExcelや互換ソフトで開き、印刷・管理保存用にご活用いただけます。
        </p>
        
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontWeight: 'bold', fontSize: '16px' }}>【受付リスト並び順選択】: </span>
            <label style={{ marginRight: '16px', marginLeft: '8px', cursor: 'pointer' }}>
              <input 
                type="radio" 
                name="sortOrder" 
                checked={sortOrder === 'name'} 
                onChange={() => setSortOrder('name')} 
                style={{ marginRight: '4px' }}
              />
              五十音順 (氏名)
            </label>
            <label style={{ cursor: 'pointer' }}>
              <input 
                type="radio" 
                name="sortOrder" 
                checked={sortOrder === 'date'} 
                onChange={() => setSortOrder('date')}
                style={{ marginRight: '4px' }}
              />
              申込受付順
            </label>
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <button className="btn btn-primary" onClick={exportReceptionRegistry} disabled={isActionPending}>
            A. 受付用予約者リスト 出力 (.xlsx)
          </button>
          <button className="btn btn-outline" onClick={exportAdminArchive} disabled={isActionPending}>
            B. 管理保存用予約者リスト 出力 (.xlsx)
          </button>
        </div>
      </div>
      
      {/* Reservations List */}
      <div className="card">
        <h2>予約者一覧 ({reservations.length}件)</h2>
        
        <div style={{ margin: '16px 0 24px 0' }}>
          <label className="form-label" style={{ fontSize: '16px' }} htmlFor="searchField">予約者検索</label>
          <input
            type="text"
            id="searchField"
            className="form-control"
            placeholder="氏名、メールアドレス、予約番号で検索 (部分一致)"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
        
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>予約番号</th>
                <th>氏名</th>
                <th>メールアドレス (マスク表示)</th>
                <th>該当区分</th>
                <th>人数</th>
                <th>申込日時</th>
                <th>受付状態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {reservations.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
                    該当する予約者が見つかりません。
                  </td>
                </tr>
              ) : (
                reservations.map((res) => (
                  <tr key={res.id}>
                    <td style={{ fontFamily: 'monospace' }}>{res.reservation_code}</td>
                    <td style={{ fontWeight: 'bold' }}>{res.name} 様</td>
                    <td style={{ fontSize: '14px', color: '#555' }}>{res.email}</td>
                    <td>{res.category}</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{res.participant_count}名</td>
                    <td style={{ fontSize: '14px' }}>
                      {res.created_at ? new Date(res.created_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : ''}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        style={{ 
                          border: 'none', 
                          borderRadius: '4px', 
                          padding: '4px 8px', 
                          fontSize: '13px', 
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          backgroundColor: res.checked_in === 1 ? '#E8F5E9' : '#ECEFF1',
                          color: res.checked_in === 1 ? 'var(--color-success)' : '#78909C'
                        }}
                        onClick={() => handleToggleCheckin(res.id, res.checked_in)}
                        disabled={isActionPending}
                      >
                        {res.checked_in === 1 ? '🟢 受付済' : '⚪ 未受付'}
                      </button>
                    </td>
                    <td>
                      <button 
                        className="btn btn-outline" 
                        style={{ height: '32px', fontSize: '13px', padding: '0 8px', width: 'auto', display: 'inline-block' }}
                        onClick={() => handleViewDetail(res.id)}
                      >
                        詳細/変更
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* ==========================================
          MODAL: DETAILS VIEW (Unmasked full details)
          ========================================== */}
      {detailModalOpen && selectedResDetail && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '640px',
            maxHeight: '90vh',
            overflowY: 'auto',
            margin: 0,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            backgroundColor: '#FFF'
          }}>
            <h2 style={{ marginBottom: '20px' }}>予約詳細情報</h2>
            
            <div className="ticket" style={{ borderStyle: 'solid', borderWidth: '1px', borderColor: '#DDD', margin: '0 0 24px 0' }}>
              <div className="ticket-row">
                <span className="ticket-label">予約番号</span>
                <span className="ticket-value" style={{ fontFamily: 'monospace' }}>{selectedResDetail.reservation_code}</span>
              </div>
              <div className="ticket-row">
                <span className="ticket-label">お名前</span>
                <span className="ticket-value large">{selectedResDetail.name} 様</span>
              </div>
              <div className="ticket-row">
                <span className="ticket-label">メールアドレス</span>
                <span className="ticket-value" style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>{selectedResDetail.email}</span>
              </div>
              <div className="ticket-row">
                <span className="ticket-label">該当区分</span>
                <span className="ticket-value">{selectedResDetail.category}</span>
              </div>
              <div className="ticket-row">
                <span className="ticket-label">申し込み人数</span>
                <span className="ticket-value large">{selectedResDetail.participant_count} 名</span>
              </div>
              <div className="ticket-row">
                <span className="ticket-label">知ったきっかけ</span>
                <span className="ticket-value">
                  {selectedResDetail.discovery_source}
                  {selectedResDetail.discovery_source_other && ` (${selectedResDetail.discovery_source_other})`}
                </span>
              </div>
              <div className="ticket-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <span className="ticket-label" style={{ marginBottom: '4px' }}>今後希望するイベント</span>
                <span className="ticket-value" style={{ textAlign: 'left', fontWeight: 'normal', color: '#333' }}>
                  {selectedResDetail.requested_event || '(特になし)'}
                </span>
              </div>
              <div className="ticket-row">
                <span className="ticket-label">申込日時</span>
                <span className="ticket-value">
                  {selectedResDetail.created_at ? new Date(selectedResDetail.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : ''}
                </span>
              </div>
              <div className="ticket-row">
                <span className="ticket-label">受付状態</span>
                <span className="ticket-value" style={{ color: selectedResDetail.checked_in === 1 ? 'var(--color-success)' : '#888' }}>
                  {selectedResDetail.checked_in === 1 ? `受付済み (${new Date(selectedResDetail.checked_in_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })})` : '未受付'}
                </span>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="btn btn-accent" 
                  style={{ flex: 1, height: '48px', fontSize: '15px' }}
                  onClick={() => handleToggleCheckin(selectedResDetail.id, selectedResDetail.checked_in)}
                  disabled={isActionPending}
                >
                  {selectedResDetail.checked_in === 1 ? '受付を未完了に戻す' : '受付済みにする'}
                </button>
                <button 
                  className="btn btn-outline" 
                  style={{ flex: 1, height: '48px', fontSize: '15px', color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                  onClick={() => handleCancelReservation(selectedResDetail.id)}
                  disabled={isActionPending}
                >
                  この予約をキャンセル
                </button>
              </div>
              
              <button 
                className="btn btn-outline" 
                style={{ height: '48px', fontSize: '15px', marginTop: '8px' }}
                onClick={() => { setDetailModalOpen(false); setSelectedResDetail(null); }}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}
