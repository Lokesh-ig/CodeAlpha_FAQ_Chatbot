import re
import nltk
from nltk.corpus import stopwords


# Load English stop words
stop_words = set(stopwords.words("english"))


def preprocess(text):
    # Step 1: Convert text to lowercase
    text = text.lower()

    # Step 2: Remove punctuation
    text = re.sub(r"[^\w\s]", "", text)

    # Step 3: Tokenize the text
    tokens = nltk.word_tokenize(text)

    # Step 4: Remove stop words
    filtered_tokens = [
        word for word in tokens
        if word not in stop_words
    ]

    # Step 5: Convert the tokens back into a sentence
    cleaned_text = " ".join(filtered_tokens)

    return cleaned_text