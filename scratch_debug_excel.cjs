const ExcelJS = require('exceljs');

async function debugExcel() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('./ornek.xlsx');
  const worksheet = workbook.worksheets[0];

  console.log("Name of sheet:", worksheet.name);
  console.log("Images Count:", worksheet.getImages().length);
  
  const images = worksheet.getImages();
  images.forEach((img, i) => {
    console.log(`Image ${i} range: Col ${img.range.tl.col}, Row ${img.range.tl.row}`);
  });

  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      // is merged check
      let isMaster = true;
      if (cell.isMerged) {
        isMaster = (cell.master.address === cell.address);
      }
      if (!isMaster) return;

      let val = cell.value;
      let text = '';
      if (typeof val === 'string') {
        text = val;
      } else if (val && val.richText) {
        text = val.richText.map(rt => rt.text).join('');
      } else if (val && val.result) {
        text = String(val.result);
      } else if (typeof val === 'number') {
        text = String(val);
      }

      if (text) {
         if (text.includes('\n')) {
           console.log(`[Merged/Multiline] R${rowNumber}C${colNumber}:`, JSON.stringify(text));
         } else if (/^\d{2,6}$/.test(text.trim())) {
           console.log(`[Number] R${rowNumber}C${colNumber}:`, JSON.stringify(text));
         } else {
            // Just log to see if it's name and number separated
            const trimmed = text.trim();
            if (trimmed.length > 0 && trimmed.length < 50) {
              console.log(`[Text] R${rowNumber}C${colNumber}:`, JSON.stringify(trimmed));
            }
         }
      }
    });
  });
}
debugExcel().catch(console.error);
