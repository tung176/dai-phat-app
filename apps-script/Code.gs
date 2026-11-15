/**
 * ĐẠI PHÁT - HỘP THƯ LƯU PHIẾU GIẶT LÀ
 *
 * Đoạn mã này chạy trong Google Sheet của tiệm (mỗi năm một Sheet, mỗi Sheet một đoạn mã này).
 * App gửi phiếu tới đây bằng POST, mã này ghi thành từng dòng trong Sheet.
 *
 * MÃ BÍ MẬT KHÔNG NẰM TRONG MÃ NÀY. Chủ tiệm đặt trong Script Properties:
 *   Project Settings (biểu tượng bánh răng) > Script Properties > Add script property
 *   Property: MA_BI_MAT    Value: một câu dài từ 20 ký tự (chữ, số, gạch nối), không dùng lại mật khẩu nơi khác.
 * Cùng mã đó được gói vào "mã cài đặt" dán vào màn Cài đặt của app.
 *
 * @OnlyCurrentDoc
 * (Dòng trên giới hạn quyền: mã chỉ đụng được đúng Google Sheet chứa nó.)
 */

var PROP_SECRET = 'MA_BI_MAT';
var MIN_SECRET = 12;

// Các tab dữ liệu. Cột đầu của mỗi tab là mã bản ghi (khóa). Tab 'Phiếu' dùng từ ticket 02,
// các tab còn lại được tạo sẵn (chỉ có dòng tiêu đề) để các ticket sau điền vào.
// Thứ tự cột khớp với src/core/dong-phieu.ts của app. Muốn thêm cột: thêm ở CUỐI.
var TABS = {
  'Phiếu': ['Mã phiếu', 'Tên khách', 'Số điện thoại', 'Ngày nhận', 'Mô tả', 'Ghi chú',
    'Tổng tiền', 'Ngày trả', 'Phương thức', 'Trạng thái', 'Cập nhật lúc'],
  'Khách': ['Mã khách', 'Tên', 'Số điện thoại', 'Ghi chú', 'Cập nhật lúc'],
  'Dịch vụ': ['Mã dịch vụ', 'Tên', 'Đơn vị', 'Đơn giá', 'Cập nhật lúc'],
  'Dòng phiếu': ['Mã dòng', 'Mã phiếu', 'Mã dịch vụ', 'Số lượng', 'Đơn giá', 'Thành tiền', 'Cập nhật lúc'],
  'Nhật ký': ['Mã', 'Thời điểm', 'Hành động', 'Mã phiếu', 'Chi tiết']
};

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Mở địa chỉ Web app bằng trình duyệt chỉ để kiểm tra đang chạy. Dữ liệu chỉ đi qua doPost kèm mã bí mật.
function doGet() {
  return out_({ ok: true, message: 'Hộp thư Đại Phát đang chạy. App gửi dữ liệu bằng POST kèm mã bí mật.' });
}

function doPost(e) {
  try {
    var secret = PropertiesService.getScriptProperties().getProperty(PROP_SECRET);
    if (!secret || String(secret).length < MIN_SECRET) {
      return out_({ ok: false, error: 'Chưa đặt mã bí mật: thêm Script property ' + PROP_SECRET + ' (từ ' + MIN_SECRET + ' ký tự trở lên).' });
    }
    var req = JSON.parse(e.postData.contents);
    if (req.secret !== secret) {
      return out_({ ok: false, error: 'Sai mã bí mật.' });
    }
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      ensureTabs_(ss);
      if (req.action === 'ping') return out_(ping_(ss));
      if (req.action === 'upsert') return out_(upsert_(ss, req.tab, req.rows || []));
      if (req.action === 'pull') return out_(pull_(ss, req.tab));
      return out_({ ok: false, error: 'Yêu cầu không hợp lệ.' });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

// Tạo đủ các tab (nếu thiếu) với dòng tiêu đề, cố định dòng 1, và để toàn bộ ô là chữ thuần
// (giữ nguyên số điện thoại 090..., ngày 2026-11-01, không cho Sheets tự đổi kiểu).
function ensureTabs_(ss) {
  for (var name in TABS) {
    if (!TABS.hasOwnProperty(name)) continue;
    if (ss.getSheetByName(name)) continue;
    var headers = TABS[name];
    var sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A:Z').setNumberFormat('@');
  }
}

function tab_(ss, name) {
  if (!name || !TABS.hasOwnProperty(name)) throw new Error('Tab không hợp lệ.');
  return ss.getSheetByName(name);
}

function ping_(ss) {
  var tabs = {};
  for (var name in TABS) {
    if (!TABS.hasOwnProperty(name)) continue;
    var sh = ss.getSheetByName(name);
    tabs[name] = sh && sh.getLastRow() >= 2 ? sh.getLastRow() - 1 : 0;
  }
  return { ok: true, tabs: tabs };
}

// Ghi các dòng: có mã rồi thì cập nhật dòng đó, chưa có thì thêm vào cuối. Gửi lại nhiều lần không bị trùng.
// Kiểm tra hết trước khi ghi: một dòng sai thì báo lỗi và không ghi gì (app giữ lại để gửi sau, không mất).
function upsert_(ss, tabName, rows) {
  var sh = tab_(ss, tabName);
  var n = TABS[tabName].length;

  var batch = {};
  var order = [];
  for (var k = 0; k < rows.length; k++) {
    var r = rows[k];
    if (!r || r.length !== n) throw new Error('Dòng thứ ' + (k + 1) + ' không đủ ' + n + ' cột.');
    var id = String(r[0]);
    if (!id) throw new Error('Dòng thứ ' + (k + 1) + ' thiếu mã.');
    var cells = [];
    for (var c = 0; c < n; c++) cells.push(text_(r[c]));
    // Trong cùng một lần gửi, mã nào lặp lại thì lấy dòng cuối.
    if (!batch.hasOwnProperty(id)) order.push(id);
    batch[id] = cells;
  }

  var last = sh.getLastRow();
  var index = {};
  if (last >= 2) {
    var ids = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) index[String(ids[i][0])] = i + 2;
  }

  var appendRows = [];
  var updated = 0;
  for (var j = 0; j < order.length; j++) {
    var key = order[j];
    if (index.hasOwnProperty(key)) {
      sh.getRange(index[key], 1, 1, n).setValues([batch[key]]);
      updated++;
    } else {
      appendRows.push(batch[key]);
    }
  }
  if (appendRows.length) {
    sh.getRange(last + 1, 1, appendRows.length, n).setValues(appendRows);
  }
  return { ok: true, added: appendRows.length, updated: updated };
}

function text_(v) {
  if (v === null || v === undefined) return '';
  return String(v);
}

function cellText_(ss, v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  }
  return text_(v);
}

// Trả toàn bộ các dòng của một tab (mọi ô là chữ) để app đọc lại.
function pull_(ss, tabName) {
  var sh = tab_(ss, tabName);
  var n = TABS[tabName].length;
  var rows = [];
  if (sh.getLastRow() >= 2) {
    var vals = sh.getRange(2, 1, sh.getLastRow() - 1, n).getValues();
    for (var i = 0; i < vals.length; i++) {
      if (!text_(vals[i][0])) continue;
      var row = [];
      for (var c = 0; c < n; c++) row.push(cellText_(ss, vals[i][c]));
      rows.push(row);
    }
  }
  return { ok: true, rows: rows };
}
