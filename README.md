# नेपाली पात्रो — वेबसाइट

Nepali Patro एपको वेबसाइट संस्करण: पात्रो, पञ्चाङ्ग, चाडपर्व, सुन/चाँदी, विदेशी मुद्रा, समाचार, रेडियो, राशिफल र मिति रूपान्तरण।

## कसरी चल्छ
- `index.html` — पूरै वेबसाइट (एउटै फाइल)।
- `scripts/update.mjs` — FENEGOSIDA (सुन/चाँदी), नेपाल राष्ट्र बैंक (मुद्रा), समाचार RSS र radio-browser बाट डाटा तानेर `data/*.json` बनाउँछ।
- `.github/workflows/update-data.yml` — GitHub Actions ले हरेक घण्टा माथिको स्क्रिप्ट चलाएर `data/` अपडेट गर्छ। निःशुल्क।
- कुनै स्रोत नचलेमा पुरानो डाटा नै रहन्छ, साइट खाली हुँदैन।

## पहिलो पटक सेटअप
1. GitHub मा नयाँ **public** रिपो बनाउनुहोस् (जस्तै `nepalipatro`) र यी सबै फाइल अपलोड गर्नुहोस्।
2. Settings → Actions → General → Workflow permissions → **Read and write permissions** छान्नुहोस् → Save।
3. Settings → Pages → Source: **Deploy from a branch**, Branch: `main` / `(root)` → Save।
4. Actions ट्याब → "Update live data" → **Run workflow** थिच्नुहोस्।
5. केही मिनेटमा साइट खुल्छ: `https://<username>.github.io/<repo>/`

## आफ्नै डोमेन
Settings → Pages → Custom domain मा डोमेन राख्नुहोस् र डोमेन कम्पनीमा GitHub ले भनेको DNS रेकर्ड थप्नुहोस्।

## पात्रो डाटा
वि.सं. २०८२–२०८३ को महिनाको दिन र २०८३ का चाडपर्व `index.html` भित्र छन्। नयाँ वर्ष थप्न `BS_DATA` र `EVENTS` अपडेट गर्नुहोस्।

सम्पर्क: nepalipatro.help@gmail.com
