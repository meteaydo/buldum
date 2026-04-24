# Excel Parse (Öğrenci Aktarım Alanı) Sistemi Dökümantasyonu 

Bu doküman, sisteminizdeki Excel dosyalarından öğrenci bilgileri ve fotoğrafları alan yapıya (Parser) ait teknolojileri, çalışma prensibini ve veritabanı iletişimini açıklamaktadır.

## 1. Sistemin Amacı ve Genel İşleyişi
Uygulamanızda öğrencileri sisteme toplu olarak dahil etmek için iki farklı yöntem kullanılmaktadır:
1. Öğretmenin kendi Excel dosyasını (örneğin e-okul veya kendi tuttuğu liste formatında) yüklemesi.
2. Cloudflare R2'de daha önceden yüklenmiş ("9A", "10B" vb.) hazır sınıf Excel şablonlarının otomatik indirilip ayrıştırılması.

Sistem, yüklenen dosyayı tarayıcı (browser) içerisinde okur, her bir birleştirilmiş veya tekil hücreyi dolaşıp; **"Ad Soyad"** ve alt satırında bulunan **"Öğrenci Numarası"** formatını tespit eder. Aynı zamanda Excel dosyasının içine gömülmüş (insert edilmiş) fotoğraflar bulunuyorsa, bunların sayfadaki koordinatlarını hücrelerin koordinatlarıyla çarprazlayarak "hangi fotoğrafın hangi öğrenciye ait olduğunu" tespit eder ve eşleştirir.

## 2. Kullanılan Teknolojiler

- **`exceljs`:** Tüm Excel (XLSX) ayrıştırma operasyonunun omurgasıdır. Sadece metinleri okumakla kalmaz, aynı zamanda hücre birleştirmelerini (`isMerged`), satır/sütun koordinatlarını, font özelliklerini ve en önemlisi **Excel'e gömülü resimleri (media)** okumak için kullanılır.
- **Cloudflare R2:** Hem hazır önceden yüklenmiş şablon listelerinin JSON olarak tutulduğu yer hem de offline senaryo sonrası fotoğrafların kalıcı olarak saklandığı (Object Storage) bulut depolama sunucusudur.
- **Firebase Firestore:** Öğrencilerin ayrıştırılıp son halini aldığı (isim, no, fotoğraf url'si vb.) metinsel dataların saklandığı NoSQL Veritabanı çözümüdür.
- **`browser-image-compression`:** Excel'den ayrıştırılan ağır/yüksek çözünürlüklü fotoğraflar belleği şişirmesin ve hızlı yüklensin diye tarayıcı üzerinde fotoğraf sıkıştırma yapan araçtır.
- **`IndexedDB` (idb üzerinden):** Arka plan yükleme kuyruğu (offline storage) altyapısının veritabanıdır. Görsellerin internet olmadan cihaz içinde cache'lenmesini sağlar.

## 3. Çalışma Mantığı ve Eşleştirme (Algoritma)

Ayrıştırma (Parse) işlemi `src/lib/excelStudentParser.ts` dosyasında şu adımlarla gerçekleşir:

1. **Hazırlık (Buffer Çıkarımı):** Dosya `ArrayBuffer`'a dönüştürülüp `exceljs`'in `Workbook` nesnesine yüklenir.
2. **Hücreleri Dolaşma:** Sadece Master Hücreleri (eğer hücre birleşmişse ilkini) baz alarak dolaşır. İçerisinde yeni satır (Enter / `\n`) bulunan metinleri yakalar.
3. **Regex Kontrolü:** Metnin son satırı `^\d{2,6}$` (2 ila 6 haneli sadece sayı) formatına, yani bir öğrenci numarasına uyuyorsa; üstündeki metni Ad/Soyad, altındakini Numara olarak tanımlar.
4. **Fotoğraf ile Öğrenci Eşleşmesi:**
   - Excel sayfasında konumlanmış tüm fotoğrafların Sol-Üst (Top-Left) Row ve Col çapaları (Anchor) çıkartılır.
   - Bulunan tüm öğrenci hücrelerinin `col` ve `row` değerleri ile resimlerin bağlantı anchor değerleri bir matematiksel formülle mesafelendirilir: `colDist * 10 + rowDist`. 
   - En düşük uzaklık (En yakın) değerine sahip olan fotoğraf, o öğrencininki olarak işaretlenip öğrenci nesnesine `foto: Blob` olarak eklenir. `(Tolerans sınırları: Sütun sapması maks 2, satır sapması maks 5 hücre olabilir.)`

## 4. Veritabanı İşlemleri (Kaydetme Aşaması)

Kullanıcı arayüzde Excel'den ayrıştılan listeyi kontrol edip "Onayla" tuşuna bastığında şu süreç işler (`CourseDetailPage.tsx`):
1. Sistem `courses/{courseId}/students` koleksiyonu altında her öğrenci için bir Document Reference (Kimlik ID'si) ayırır.
2. Excel'den çıkan fotoğraflar direkt Firebase'e yüklenmez! Fotoğraf Blob verisi `queueImageUpload` isimli yapıya atılır. Bu dosya sıkıştırmasını yapıp arka plan kuyruğuna koyar ve geriye hemen bir **`local://...`** URL'i döndürür.
3. Firestore'daki öğrenci dokümanlarına fotoğraf alanı olarak bu `local://` linkleri eklenmiş haldeki Student dizisi, performans için tek bir işlemde (Batch operation) sisteme basılır (`addStudentsBulk`).

## 5. Çevrimdışı (Offline) Yükleme Özelliği

Dosya okuma, ayrıştırma ve fotoğraf işleme adımlarının tamamı **Offline olarak çalışabilecek şekilde kurgulanmıştır**.

- **Uçtan Uca Çevrimdışı Caching:** Kullanıcı (Öğretmen) metrodayken veya interneti koptuğunda bir excel import edip onayladığında; ayrıştırılan fotolar IndexedDB'ye eklenir ve onlara verilen sahte `local://` url'leri sayesinde uygulama içinde sorunsuz olarak görüntülenmeye devam edilir. UI seviyesinde hiçbir bozulma veya bekleme ekranı yaşanmaz.
- **Senkronizasyon (Foreground / Background Sync):** `src/lib/imageQueue.ts` dosyası içindeki `processQueue()` mekanizması, internet geldiği (Tarayıcıdan `online` event'i ateşlendiği) anda devreye girer.
- Cihaz IndexedDB'de bekleyen resimleri Cloudflare R2'ye upload eder ve Firebase üzerinde o dokümanın `local://` yazan alanını, asıl R2'nin verdiği internet linkiyle otomatik ve sessiz bir şekilde değiştirir (Atomik Update). 

Bu yaklaşım, öğretmenin mobil veya dar bantlı internet bağlantısında devasa Excel dosyalarındaki fotoğrafların upload olmasını donuk bir ekranda saniyelerce beklemesinin önüne geçer. Akıcı bir kullanıcı deneyimi (UX) sunar.
