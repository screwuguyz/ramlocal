// Arman için 16 Aralık devamsızlık puanı ekleme scripti
// Admin olarak giriş yaptıktan sonra tarayıcı konsolunda (F12 -> Console) çalıştır

(async function fixArman16Dec() {
  // Önce mevcut state'i al
  const res = await fetch('/api/state');
  const state = await res.json();
  
  console.log('Mevcut state alındı:', state);
  
  // Arman'ı bul
  const arman = state.teachers.find(t => t.name.toUpperCase().includes('ARMAN'));
  if (!arman) {
    console.error('Arman bulunamadı!');
    return;
  }
  console.log('Arman bulundu:', arman);
  
  // 16 Aralık için history'ye devamsızlık kaydı ekle
  const day = '2025-12-16';
  const ym = '2025-12';
  
  if (!state.history[day]) {
    state.history[day] = [];
  }
  
  // Zaten eklenmişse tekrar ekleme
  const existingPenalty = state.history[day].find(c => 
    c.absencePenalty && c.assignedTo === arman.id
  );
  
  if (existingPenalty) {
    console.log('16 Aralık için devamsızlık kaydı zaten var:', existingPenalty);
    return;
  }
  
  // Yeni devamsızlık kaydı oluştur
  const penaltyCase = {
    id: 'fix_arman_16dec_' + Date.now(),
    student: `${arman.name} - Devamsız`,
    score: 4, // En düşük 7 - 3 = 4
    createdAt: `${day}T23:59:00.000Z`,
    assignedTo: arman.id,
    type: 'DESTEK',
    isNew: false,
    diagCount: 0,
    isTest: false,
    assignReason: 'Devamsızlık sonrası dengeleme puanı: en düşük 7 - 3 = 4 (manuel düzeltme)',
    absencePenalty: true
  };
  
  state.history[day].push(penaltyCase);
  console.log('Devamsızlık kaydı eklendi:', penaltyCase);
  
  // Arman'ın aylık ve yıllık puanını güncelle
  const teacherIndex = state.teachers.findIndex(t => t.id === arman.id);
  if (teacherIndex >= 0) {
    // Aylık puanı güncelle (48 + 4 = 52)
    if (!state.teachers[teacherIndex].monthly) {
      state.teachers[teacherIndex].monthly = {};
    }
    const oldMonthly = state.teachers[teacherIndex].monthly[ym] || 0;
    state.teachers[teacherIndex].monthly[ym] = oldMonthly + 4;
    
    // Yıllık puanı güncelle
    const oldYearly = state.teachers[teacherIndex].yearlyLoad || 0;
    state.teachers[teacherIndex].yearlyLoad = oldYearly + 4;
    
    console.log(`Arman puanları güncellendi: Aylık ${oldMonthly} -> ${state.teachers[teacherIndex].monthly[ym]}, Yıllık ${oldYearly} -> ${state.teachers[teacherIndex].yearlyLoad}`);
  }
  
  // State'i kaydet
  state.updatedAt = new Date().toISOString();
  
  const saveRes = await fetch('/api/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state)
  });
  
  const result = await saveRes.json();
  
  if (result.ok) {
    console.log('✅ BAŞARILI! Arman için 16 Aralık devamsızlık puanı eklendi.');
    console.log('Sayfa yenilenince değişiklikler görünecek.');
    alert('✅ Arman için 4 puan eklendi! Sayfayı yenile.');
  } else {
    console.error('❌ HATA:', result);
    alert('Hata: ' + JSON.stringify(result));
  }
})();




