# Müşteri pilotu kılavuzu

Bu depo finansal sorulara verilen AI yanıtlarını ölçen bir değerlendirme kitidir. Üç kamu raporu alıntısı ve 30 sentetik hesap sorusu hazırdır. Tam PDF araması, müşteri belge yükleme ve otomatik finansal karar verme şu anda yoktur.

## 1. Keşif görüşmesi

Müşteriden kullanım senaryosunu, modeli veya örnek yanıtlarını, veri kaynağı ve kullanım iznini, değerlendirmeyi onaylayacak finans uzmanını öğrenin. Pilot başlamadan başarı ölçütlerini yazın: sayısal doğruluk, kaynak doğruluğu, API kapsaması, gerekçe kalitesi ve kabul eşiği. Çıktı: örnek sayısı, veri sınırı, tarih, teslimler ve kabul ölçütlerini içeren tek sayfalık kapsam.

## 2. Çalışan demoyu gösterme

    git clone https://github.com/pars1905/finance-ai-quality-benchmark.git
    cd finance-ai-quality-benchmark
    python -m unittest discover -s tests -q
    python -m finance_benchmark run --provider baseline --dataset real-filings-v1 --output results/control

Baseline cevap anahtarını kopyalayan kontrol koşusudur; model başarısı değildir. Üç örneklik gerçek model incelemesini ve kapsam sınırlarını [inceleme kaydından](../reviews/real-filings-v1-gemini-review.md) gösterin.

## 3. Modeli bağlama

Müşteri kendi modelinden JSON yanıtları üretebiliyorsa mevcut üç örnek için çevrimdışı değerlendirme:

    python -m finance_benchmark evaluate path/to/customer-predictions.json --dataset real-filings-v1 --output results/customer-pilot
    cat results/customer-pilot/report.md

Yanıt nesnesi case_id, value, source_refs, explanation ve abstained alanlarını içermelidir. Doğrudan API için modelin OpenAI uyumlu chat/completions uç noktası ve JSON nesnesi yanıtı desteklemesi gerekir:

    export AI_API_KEY='customer-managed-key'
    export AI_API_BASE_URL='https://customer-approved-endpoint/v1'
    python -m finance_benchmark run --provider api --model CUSTOMER_MODEL_ID --dataset real-filings-v1 --delay-seconds 20 --output results/customer-api-pilot

Anahtar ve müşteri yanıtları GitHub'a yüklenmez. Servis, veri işleme yeri, erişim ve saklama süresini müşteri belirler. --resume yalnızca aynı model ve aynı veri kümesiyle kullanılır; CLI model kimliğini otomatik doğrulamaz.

## 4. Müşteri veri kümesi

Mevcut CLI yalnızca synthetic-v1 ve real-filings-v1 veri kümelerini destekler. Yeni müşteri seti için data/ altında sürümlü JSON oluşturup finance_benchmark/core.py içindeki DATASETS ve cases() fonksiyonlarını genişletin. Belge ve tablo konumu, dönem, birim, karşılaştırma bazı, uzman onaylı cevap ve kaynak kimliklerini kaydedin. Yanlış dönem, eksik kanıt, birim karmaşası ve gerekçesi hatalı doğru sayılar gibi zor örnekleri dahil edin.

## 5. Pilot ölçümü ve teslim

report.json, report.md ve predictions.json dosyalarını üretin. API hatalarını model hatalarından ayrı raporlayın; açıklamaları ve muhasebe bağlamını uzmanla inceleyin. Hataları nedenine göre ayırıp puanlayıcı/cevap anahtarı sorunlarını ayrıca düzeltin. Teslim: sürümlü veri kümesi, yeniden çalıştırma adımları, örnek bazlı bulgular, sınırlamalar ve müşterinin önceden kabul ettiği eşiklere göre karar.

Tam belge akışı istenirse belge alma, tablo çıkarma, sayfa bağlantıları, erişim kontrolü ve insan onayı için ayrı uygulama ve test kapsamı çıkarın. Üç seçilmiş alıntıdaki 3/3 sonucu, görülmemiş müşteri belgelerine genellenemez.
