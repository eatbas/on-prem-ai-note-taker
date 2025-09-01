"""Language-specific prompts for transcription and summarization"""

# English prompts
CHUNK_PROMPT_EN = """You are an expert meeting-minutes assistant. Summarize the following transcript chunk in English.
Output strictly as:
- Key Points
- Decisions
- Action Items (Who, What, When)

Keep names, dates, amounts. If a speaker is unknown, write 'Owner: TBD'. Text:

{chunk}"""

MERGE_PROMPT_EN = """Merge these bullet summaries into a clean, non-duplicated Meeting Minutes with sections:
1) Overview (3-5 bullets)
2) Decisions (bulleted)
3) Action Items (Owner, Due date)
4) Risks/Dependencies

Keep the language English and keep it concise.

Summaries to merge:
{summaries}"""

# Turkish prompts
CHUNK_PROMPT_TR = """Uzman bir toplantı notçusun. Aşağıdaki metin parçasını Türkçe özetle.
Çıktı formatı:
- Ana Başlıklar
- Alınan Kararlar
- Aksiyonlar (Kim, Ne, Ne zaman)

İsimleri, tarihleri ve tutarları koru. Konuşmacı bilinmiyorsa 'Sahip: TBD' yaz. Metin:

{chunk}"""

MERGE_PROMPT_TR = """Bu madde özetlerini temiz, tekrarsız Toplantı Notları olarak birleştir:
1) Genel Bakış (3-5 madde)
2) Alınan Kararlar (madde halinde)
3) Aksiyonlar (Sahip, Bitiş tarihi)
4) Riskler/Bağımlılıklar

Dili Türkçe tut ve kısa tut.

Birleştirilecek özetler:
{summaries}"""

# Auto language prompt (defaults to Turkish for better local support)
CHUNK_PROMPT_AUTO = CHUNK_PROMPT_TR
MERGE_PROMPT_AUTO = MERGE_PROMPT_TR

# One-shot summary prompts
SINGLE_SUMMARY_PROMPT_EN = (
    "You are an assistant that writes concise meeting notes. "
    "Summarize the following transcript into: 1) a concise summary (3-6 sentences), "
    "2) key decisions, 3) action items with owners if possible, 4) open questions.\n\n"
    "Transcript:\n{transcript}"
)

SINGLE_SUMMARY_PROMPT_TR = (
    "Kısa ve öz toplantı notları yazan bir asistansın. "
    "Aşağıdaki metni şu başlıklarla özetle: 1) Kısa özet (3-6 cümle), "
    "2) Alınan kararlar, 3) Aksiyonlar (mümkünse sahipleriyle), 4) Açık sorular.\n\n"
    "Metin:\n{transcript}"
)

def get_chunk_prompt(language: str) -> str:
    """Get the appropriate chunk prompt based on language"""
    if language == "tr":
        return CHUNK_PROMPT_TR
    elif language == "en":
        return CHUNK_PROMPT_EN
    else:
        return CHUNK_PROMPT_AUTO

def get_merge_prompt(language: str) -> str:
    """Get the appropriate merge prompt based on language"""
    if language == "tr":
        return MERGE_PROMPT_TR
    elif language == "en":
        return MERGE_PROMPT_EN
    else:
        return MERGE_PROMPT_AUTO


def get_single_summary_prompt(language: str) -> str:
    """Get the appropriate one-shot summary prompt based on language"""
    if language == "tr" or language == "auto":
        return SINGLE_SUMMARY_PROMPT_TR
    elif language == "en":
        return SINGLE_SUMMARY_PROMPT_EN
    # Default to Turkish for better local support
    return SINGLE_SUMMARY_PROMPT_TR


# 🚨 PHASE 4.4: Speaker-Enhanced Summary Prompts
SPEAKER_ENHANCED_SUMMARY_PROMPT_EN = """You are an expert meeting analyst who creates comprehensive meeting summaries with speaker insights.

Given a meeting transcript with speaker information, create a detailed summary following this structure:

## Meeting Overview
[2-3 sentences describing the meeting's main purpose and outcome]

## Speaker Participation
[Brief overview of who participated and their engagement levels]

## Key Discussion Points
[Organize by main topics, showing who said what]
- **Topic 1**: Speaker 1 mentioned that... Speaker 2 responded by... Speaker 3 added...
- **Topic 2**: Speaker 1 proposed... Speaker 2 raised concerns about... 

## Decisions Made
[List decisions with who proposed/supported them]
- **Decision 1**: Proposed by Speaker 1, supported by Speaker 2...
- **Decision 2**: Speaker 3 suggested... Speaker 1 agreed...

## Action Items
[Clear action items with speaker ownership]
- **Speaker 1**: [Action item with details]
- **Speaker 2**: [Action item with details]

## Speaker Insights
[Analysis of each speaker's contributions]
- **Speaker 1** (X% talking time): [Key contributions, communication style]
- **Speaker 2** (X% talking time): [Key contributions, communication style]

## Next Steps & Open Questions
[Future actions and unresolved items]

Transcript with speakers:
{transcript_with_speakers}

Speaker Statistics:
{speaker_stats}"""

SPEAKER_ENHANCED_SUMMARY_PROMPT_TR = """Konuşmacı analizi yapan uzman bir toplantı analistisin. Konuşmacı bilgileri olan toplantı metninden detaylı özet çıkar.

Aşağıdaki yapıyı takip et:

## Toplantı Genel Bakış
[Toplantının ana amacını ve sonucunu anlatan 2-3 cümle]

## Konuşmacı Katılımı
[Kimler katıldı ve katılım seviyeleri hakkında kısa bilgi]

## Ana Tartışma Konuları
[Ana konulara göre organize et, kim ne söyledi göster]
- **Konu 1**: Konuşmacı 1 şunu belirtti... Konuşmacı 2 şu şekilde yanıtladı... Konuşmacı 3 ekledi...
- **Konu 2**: Konuşmacı 1 önerdi... Konuşmacı 2 endişelerini dile getirdi...

## Alınan Kararlar
[Kararları kimin önerdiği/desteklediği ile birlikte listele]
- **Karar 1**: Konuşmacı 1 tarafından önerildi, Konuşmacı 2 destekledi...
- **Karar 2**: Konuşmacı 3 önerdi... Konuşmacı 1 kabul etti...

## Aksiyon Maddeleri
[Konuşmacı sahipliği ile net aksiyon maddeleri]
- **Konuşmacı 1**: [Detaylı aksiyon maddesi]
- **Konuşmacı 2**: [Detaylı aksiyon maddesi]

## Konuşmacı Analizi
[Her konuşmacının katkılarının analizi]
- **Konuşmacı 1** (%X konuşma süresi): [Ana katkılar, iletişim stili]
- **Konuşmacı 2** (%X konuşma süresi): [Ana katkılar, iletişim stili]

## Sonraki Adımlar & Açık Sorular
[Gelecek aksiyonlar ve çözülmemiş konular]

Konuşmacılı metin:
{transcript_with_speakers}

Konuşmacı İstatistikleri:
{speaker_stats}"""


def get_speaker_enhanced_summary_prompt(language: str) -> str:
    """Get the appropriate speaker-enhanced summary prompt based on language"""
    if language == "en":
        return SPEAKER_ENHANCED_SUMMARY_PROMPT_EN
    elif language == "tr" or language == "auto":
        return SPEAKER_ENHANCED_SUMMARY_PROMPT_TR
    # Default to Turkish for better local support
    return SPEAKER_ENHANCED_SUMMARY_PROMPT_TR