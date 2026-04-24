import ExcelJS from 'exceljs';
import type { ParsedStudent } from '../store/studentStore';

export async function parseClassList(file: File): Promise<ParsedStudent[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Excel dosyası boş.');

  // Sınıf adını dosya adından al (örn: 9A.xlsx -> 9A)
  const className = file.name.replace(/\.[^/.]+$/, '').toUpperCase();

  const students: ParsedStudent[] = [];
  const images = worksheet.getImages();

  // Excel'deki resimleri işle
  const processedImages = images.map(img => {
    const imageMeta = workbook.model.media?.find(m => m.index === img.imageId);
    let base64Url = null;
    if (imageMeta && imageMeta.buffer) {
      const ext = imageMeta.extension || 'png';
      
      // Browser uyumlu Base64 çevirimi (Buffer kullanmadan)
      const uint8Array = new Uint8Array(imageMeta.buffer as any);
      let binary = '';
      for (let i = 0; i < uint8Array.byteLength; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64 = window.btoa(binary);
      
      base64Url = `data:image/${ext};base64,${base64}`;
    }
    return {
      col: img.range.tl.col,
      row: img.range.tl.row,
      url: base64Url
    };
  });

  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      let isMaster = true;
      if (cell.isMerged && cell.master) {
        isMaster = (cell.master.address === cell.address);
      }
      if (!isMaster) return;

      let text = '';
      if (typeof cell.value === 'string') {
        text = cell.value;
      } else if (cell.value && typeof cell.value === 'object' && 'richText' in cell.value) {
        text = cell.value.richText?.map(rt => rt.text).join('') || '';
      } else if (cell.value && typeof cell.value === 'object' && 'result' in cell.value) {
        text = String(cell.value.result);
      } else if (typeof cell.value === 'number') {
        text = String(cell.value);
      }

      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      
      // Eğer hücrede alt alta ad ve numara varsa (örn: "Ahmet Yılmaz\n1234")
      if (lines.length >= 2) {
        const potentialNumber = lines[lines.length - 1];
        if (/^\d{2,6}$/.test(potentialNumber)) {
          const name = lines.slice(0, lines.length - 1).join(' ');
          
          // En yakın resmi bul
          let closestImage = null;
          let minDistance = Infinity;

          for (const img of processedImages) {
            const colDist = Math.abs(img.col - (colNumber - 1));
            const rowDist = Math.abs(img.row - (rowNumber - 1));
            
            // Tolerans sınırları (excelparse.md'ye göre)
            if (colDist <= 2 && rowDist <= 5) {
              const distance = colDist * 10 + rowDist;
              if (distance < minDistance) {
                minDistance = distance;
                closestImage = img.url;
              }
            }
          }

          students.push({
            id: potentialNumber, // studentNo'yu id olarak kullanıyoruz
            studentNo: potentialNumber,
            name: name,
            photoUrl: closestImage,
            className: className
          });
        }
      }
    });
  });

  return students;
}
