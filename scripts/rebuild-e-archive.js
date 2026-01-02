// E-Arşiv'i History'den Yeniden Oluşturma Scripti
// Admin olarak giriş yaptıktan sonra tarayıcı konsolunda (F12 -> Console) çalıştır

(async function rebuildEArchive() {
  // Önce mevcut state'i al
  const res = await fetch('/api/state');
  const state = await res.json();
  
  console.log('Mevcut state alındı');
  console.log('History günleri:', Object.keys(state.history || {}).length);
  console.log('Mevcut E-Arşiv:', state.eArchive?.length || 0);
  
  // Öğretmen isimlerini ID'ye göre eşleştir
  const teacherMap = {};
  (state.teachers || []).forEach(t => {
    teacherMap[t.id] = t.name;
  });
  
  // Mevcut E-Arşiv ID'lerini al (duplicate önleme)
  const existingIds = new Set((state.eArchive || []).map(e => e.id));
  
  // History'deki tüm dosyaları E-Arşiv'e ekle
  const newArchiveEntries = [];
  
  for (const [day, cases] of Object.entries(state.history || {})) {
    for (const c of cases) {
      // Zaten varsa atla
      if (existingIds.has(c.id)) continue;
      
      // Devamsızlık/bonus kayıtlarını atla (bunlar gerçek dosya değil)
      if (c.absencePenalty || c.backupBonus) continue;
      
      // Atanmamış dosyaları atla
      if (!c.assignedTo) continue;
      
      const teacherName = teacherMap[c.assignedTo] || 'Bilinmeyen';
      
      newArchiveEntries.push({
        id: c.id,
        student: c.student,
        fileNo: c.fileNo || undefined,
        assignedToName: teacherName,
        createdAt: c.createdAt
      });
    }
  }
  
  // Bugünkü cases'i de ekle
  for (const c of (state.cases || [])) {
    if (existingIds.has(c.id)) continue;
    if (c.absencePenalty || c.backupBonus) continue;
    if (!c.assignedTo) continue;
    
    const teacherName = teacherMap[c.assignedTo] || 'Bilinmeyen';
    
    newArchiveEntries.push({
      id: c.id,
      student: c.student,
      fileNo: c.fileNo || undefined,
      assignedToName: teacherName,
      createdAt: c.createdAt
    });
  }
  
  console.log('History\'den eklenen dosya sayısı:', newArchiveEntries.length);
  
  if (newArchiveEntries.length === 0) {
    console.log('Eklenecek yeni dosya yok.');
    alert('E-Arşiv zaten güncel, eklenecek yeni dosya yok.');
    return;
  }
  
  // Mevcut E-Arşiv ile birleştir ve tarihe göre sırala
  const mergedArchive = [...(state.eArchive || []), ...newArchiveEntries];
  mergedArchive.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // State'i güncelle
  state.eArchive = mergedArchive;
  state.updatedAt = new Date().toISOString();
  
  // Kaydet
  const saveRes = await fetch('/api/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state)
  });
  
  const result = await saveRes.json();
  
  if (result.ok) {
    console.log('✅ BAŞARILI! E-Arşiv yeniden oluşturuldu.');
    console.log('Toplam E-Arşiv kayıt sayısı:', mergedArchive.length);
    alert(`✅ E-Arşiv güncellendi!\n\nEklenen: ${newArchiveEntries.length} dosya\nToplam: ${mergedArchive.length} dosya\n\nSayfayı yenile.`);
  } else {
    console.error('❌ HATA:', result);
    alert('Hata: ' + JSON.stringify(result));
  }
})();










