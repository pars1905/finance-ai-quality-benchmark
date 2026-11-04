# Üç müşteri demosu

Bu örnekler **kurgusal** şirket ve tutarlar kullanır. Örnek yanıtlar sonucu göstermek için elle hazırlanmıştır; canlı AI yanıtı veya gerçek müşteri projesi değildir. Üç komut da API anahtarı olmadan çalışır. Her demo bir sorudan oluşur; bu yüzden sonuçlar tek örnek üzerinden yüzde olarak görünür.

## 1. Yönetim raporlaması: doğru sonuç

Müşteri sorusu: “2024 gelirimiz 80 milyon USD, 2025 gelirimiz 100 milyon USD. Büyüme oranını doğru hesaplayıp iki kaynağı da gösteriyor mu?”

    python -m finance_benchmark evaluate examples/demo-fpna-predictions.json --dataset demo-fpna-v1 --output results/demo-fpna

Cevap 25.00% ve iki kaynak kimliği doğrudur. Beklenen: kapsam 1/1, sayısal doğruluk %100, kaynak doğruluğu %100, katı geçiş %100. Müşteriye, formül ve kanıt alanlarını nasıl kontrol ettiğimizi gösteririz.

## 2. Kredi analizi: hesap hatası

Müşteri sorusu: “Dönen varlık 150 milyon USD, kısa vadeli yükümlülük 100 milyon USD ise cari oran kaç?”

    python -m finance_benchmark evaluate examples/demo-credit-predictions.json --dataset demo-credit-v1 --output results/demo-credit

Beklenen 1.50 iken örnek yanıt 2.00'dır; iki kaynak kimliği doğrudur. Beklenen: sayısal doğruluk %0, kaynak doğruluğu %100, hata kodu incorrect_numeric_value. Açıklama da “150 / 100 = 2.00” diyerek hatayı tekrarlar; insan incelemesinde bu tutarsızlık belirlenir. Bu demo doğru kaynağa bakmanın tek başına doğru hesap anlamına gelmediğini gösterir.

## 3. Araştırma incelemesi: kaynak hatası

Müşteri sorusu: “Gelir 120 milyon USD, satışların maliyeti 72 milyon USD ise brüt kâr marjı kaç?”

    python -m finance_benchmark evaluate examples/demo-research-predictions.json --dataset demo-research-v1 --output results/demo-research

Örnek yanıt %40.00 ile doğru sonucu hesaplar, ancak kaynak listesinde satışların maliyeti yerine var olmayan bir faaliyet gideri kimliği verir. Beklenen: sayısal doğruluk %100, kaynak doğruluğu %0, hata kodu missing_or_incorrect_sources. Müşteriye sayı doğru olsa bile kanıt zincirinin neden ayrıca önemli olduğunu gösteririz.

## Canlı modelle deneme

Bu veri kümeleri mevcut CLI içinde tanımlıdır. Müşterinin onayladığı bir API ve anahtar hazırsa örneğin ilk demoyu Gemini ile çalıştırabilirsiniz:

    python -m finance_benchmark run --provider gemini --dataset demo-fpna-v1 --output results/demo-fpna-live

Diğer iki veri kümesi için demo-credit-v1 ve demo-research-v1 adlarını kullanın. Canlı modelin sonucu önceden tahmin edilmez; elle yazılmış örnek yanıtlarla karıştırmayın. Üç örnekten herhangi biri müşteriye özgü başarı oranı veya üretim güvenilirliği iddiası için yeterli değildir.

Her görüşmeden sonra müşterinin gerçek kullanım sorusunu, veri erişimini ve kabul ölçütlerini [müşteri pilotu kılavuzuna](customer-pilot-guide-tr.md) göre belirleyip ayrı bir test seti oluşturun.
