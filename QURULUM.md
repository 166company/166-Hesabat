# Ads Audit — Quraşdırma Təlimatı

## 1. Node.js Yüklənməsi

https://nodejs.org → "LTS" versiyasını yükləyin və quraşdırın.
Quraşdırmadan sonra terminal/PowerShell-i YENIDƏN açın.

Yoxlama:
```
node --version    # v20.x.x çıxmalıdır
npm --version     # 10.x.x çıxmalıdır
```

---

## 2. Asılılıqların Quraşdırılması

```
cd "c:\Users\Cavidan Setterzade\166 ads audit"
npm install
cd server && npm install
cd ../client && npm install
```

---

## 3. Mühit Dəyişənlərinin Tənzimlənməsi

`server/.env` faylını açın və aşağıdakıları doldurun:

### Gmail SMTP (Email göndərmək üçün)
1. Google Hesabı → Parametrlər → Təhlükəsizlik → 2-addımlı doğrulama
2. "Uygulama şifrələri" → "Ads Audit" adı ilə yeni şifrə yaradın
3. Şifrəni `SMTP_PASS=` sahəsinə yazın

### Google Ads API
1. https://console.cloud.google.com → Yeni Layihə
2. "OAuth 2.0 İstifadəçi Etimadnaməsi" yaradın (Web application)
3. Redirect URI: `http://localhost:5000/api/google/callback`
4. `GOOGLE_CLIENT_ID` və `GOOGLE_CLIENT_SECRET`-i doldurun
5. https://ads.google.com/home/tools/manager-accounts/ → Developer token əldə edin
6. `GOOGLE_ADS_DEVELOPER_TOKEN`-i doldurun

### Şifrələmə Açarı (TƏHLÜKƏSİZLİK ÜÇÜN DƏYİŞDİRİN!)
PowerShell-də: `[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`
Nəticəni hex-ə çevirin və `ENCRYPTION_KEY`-ə yazın.

---

## 4. Tətbiqin İşə Salınması

```
# Server (bir terminaldə):
cd "c:\Users\Cavidan Setterzade\166 ads audit\server"
npm run dev

# Client (başqa terminaldə):
cd "c:\Users\Cavidan Setterzade\166 ads audit\client"
npm run dev
```

Brauzer: http://localhost:5173

---

## 5. İlk Qeydiyyat

1. http://localhost:5173/register → qeydiyyatdan keçin
2. Admin mailinə (cavidanbusiness2026@gmail.com) sorğu gəlir
3. "Təsdiqlə" linkə basın
4. İstifadəçi login edə bilər

---

## 6. Meta Ads İstifadəsi

1. Meta Ads bölməsinə keçin
2. "Token əlavə et" düyməsinə basın
3. Facebook Graph API Explorer-dən User Token alın:
   - https://developers.facebook.com/tools/explorer/
   - `ads_read` icazəsini seçin
   - Token-i kopyalayın
4. Token-i sisteme əlavə edin

---

## 7. Google Ads İstifadəsi

1. Google Ads bölməsinə keçin
2. "Google Ads-ə qoşul" düyməsinə basın
3. Google hesabı ilə giriş edin
4. Email doğrulama kodunu daxil edin (Google mailinizə gəlir)

---

## Qeydlər

- App yalnız oxuma rejimindədir (hesablara heç bir dəyişiklik edilmir)
- Token-lər şifrələnərək saxlanılır
- Bütün xətalar admin mailinə göndərilir
- Chat üçün ayrıca admin icazəsi tələb olunur
