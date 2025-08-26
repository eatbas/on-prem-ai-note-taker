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

# Auto language prompt (defaults to English)
CHUNK_PROMPT_AUTO = CHUNK_PROMPT_EN
MERGE_PROMPT_AUTO = MERGE_PROMPT_EN

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
    if language == "tr":
        return SINGLE_SUMMARY_PROMPT_TR
    # Default to English
    return SINGLE_SUMMARY_PROMPT_EN
