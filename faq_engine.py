import json

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from preprocessing import preprocess


# Load FAQ data
with open("data/faqs.json", "r", encoding="utf-8") as file:
    faqs = json.load(file)


# Extract FAQ questions
faq_questions = [faq["question"] for faq in faqs]


# Preprocess all FAQ questions
processed_questions = [
    preprocess(question)
    for question in faq_questions
]


# Create TF-IDF vectorizer
vectorizer = TfidfVectorizer()


# Convert FAQ questions into TF-IDF vectors
faq_vectors = vectorizer.fit_transform(processed_questions)


print("FAQ engine loaded successfully!")
print("Total FAQs:", len(faqs))

# ==========================================
# GET ANSWER FUNCTION
# ==========================================

def get_answer(user_question):

     # Check for empty input
    if not user_question.strip():
        return None, 0.0

    # Preprocess the user's question
    processed_user_question = preprocess(user_question)

    # Check if anything meaningful remains
    if not processed_user_question.strip():
        return None, 0.0

    # Convert user question into a TF-IDF vector
    user_vector = vectorizer.transform([processed_user_question])

    # Calculate similarity with all FAQ questions
    similarity_scores = cosine_similarity(user_vector, faq_vectors)

    # Find the best matching FAQ
    best_match_index = similarity_scores[0].argmax()

    # Get the highest similarity score
    best_score = similarity_scores[0][best_match_index]

    # Set minimum similarity threshold
    threshold = 0.40

    # Get sorted indices of matches
    sorted_indices = similarity_scores[0].argsort()[::-1]

    # Find top suggestions (excluding best match if score < threshold or top 3 suggestions)
    suggestions = []
    for idx in sorted_indices[1:4]:
        s_score = float(similarity_scores[0][idx])
        if s_score >= 0.20:
            suggestions.append({
                "question": faqs[idx]["question"],
                "category": faqs[idx].get("category", "General"),
                "similarity_score": round(s_score, 4)
            })

    # Check whether the match is good enough
    if best_score < threshold:
        return None, float(best_score)

    # Get the matching FAQ
    best_faq = faqs[best_match_index]

    return best_faq, float(best_score)


def get_answer_detailed(user_question):
    """Return matching FAQ, score, and related suggestions."""
    if not user_question.strip():
        return None, 0.0, []

    processed_user_question = preprocess(user_question)
    if not processed_user_question.strip():
        return None, 0.0, []

    user_vector = vectorizer.transform([processed_user_question])
    similarity_scores = cosine_similarity(user_vector, faq_vectors)
    best_match_index = similarity_scores[0].argmax()
    best_score = similarity_scores[0][best_match_index]

    threshold = 0.40
    sorted_indices = similarity_scores[0].argsort()[::-1]

    suggestions = []
    for idx in sorted_indices[1:4]:
        s_score = float(similarity_scores[0][idx])
        if s_score >= 0.15:
            suggestions.append({
                "question": faqs[idx]["question"],
                "category": faqs[idx].get("category", "General"),
                "similarity_score": round(s_score, 4)
            })

    if best_score < threshold:
        return None, float(best_score), suggestions

    best_faq = faqs[best_match_index]
    return best_faq, float(best_score), suggestions



def get_all_categories():
    """Return list of categories with their question counts."""
    category_counts = {}
    for faq in faqs:
        cat = faq.get("category", "General")
        category_counts[cat] = category_counts.get(cat, 0) + 1
    
    result = [
        {"name": cat, "count": count}
        for cat, count in sorted(category_counts.items(), key=lambda x: x[0])
    ]
    return result


def get_faqs(category=None, search_query=None):
    """Filter FAQs by category and/or search term."""
    results = faqs
    if category and category.lower() != "all":
        results = [f for f in results if f.get("category", "").lower() == category.lower()]
    
    if search_query and search_query.strip():
        q_lower = search_query.lower()
        results = [
            f for f in results 
            if q_lower in f["question"].lower() or q_lower in f["answer"].lower()
        ]
    return results


def get_engine_stats():
    """Return summary metrics about the FAQ knowledge base."""
    categories = get_all_categories()
    return {
        "total_faqs": len(faqs),
        "total_categories": len(categories),
        "categories": categories,
        "similarity_threshold": 0.40,
        "vectorizer_vocab_size": len(vectorizer.vocabulary_) if hasattr(vectorizer, 'vocabulary_') else 0
    }