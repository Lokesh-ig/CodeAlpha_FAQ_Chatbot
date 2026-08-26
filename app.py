import os
from flask import Flask, jsonify, request, render_template, send_from_directory
from faq_engine import (
    get_answer,
    get_answer_detailed,
    get_all_categories,
    get_faqs,
    get_engine_stats
)

app = Flask(__name__, template_folder="templates", static_folder="static")


@app.route("/favicon.ico")
def favicon():
    """Serve custom website icon/favicon."""
    return send_from_directory(
        os.path.join(app.root_path, "static"),
        "favicon.svg",
        mimetype="image/svg+xml"
    )


@app.route("/")
def index():
    """Render main Chatbot Web Application Interface."""
    return render_template("index.html")



@app.route("/ask/<path:question>")
def ask_question(question):
    """Legacy GET endpoint for single question lookup."""
    faq, score = get_answer(question)

    if faq is not None:
        return jsonify({
            "question": faq["question"],
            "answer": faq["answer"],
            "category": faq.get("category", "General"),
            "similarity_score": float(score)
        })
    else:
        return jsonify({
            "question": question,
            "answer": "Sorry, I couldn't find a relevant answer to your question.",
            "similarity_score": float(score)
        })


@app.route("/api/chat", methods=["POST"])
def api_chat():
    """REST API endpoint for chat interactions."""
    data = request.get_json(silent=True) or {}
    user_question = data.get("question", "").strip()

    if not user_question:
        return jsonify({
            "success": False,
            "error": "Question parameter is required."
        }), 400

    faq, score, suggestions = get_answer_detailed(user_question)

    if score >= 0.70:
        match_quality = "High"
    elif score >= 0.40:
        match_quality = "Moderate"
    else:
        match_quality = "Low"

    if faq is not None:
        return jsonify({
            "success": True,
            "found": True,
            "user_question": user_question,
            "question": faq["question"],
            "answer": faq["answer"],
            "category": faq.get("category", "General"),
            "similarity_score": round(float(score), 4),
            "match_quality": match_quality,
            "suggestions": suggestions
        })
    else:
        return jsonify({
            "success": True,
            "found": False,
            "user_question": user_question,
            "answer": "I could not find an exact match in our banking knowledge base. Please rephrase your query or pick one of the related topics below.",
            "similarity_score": round(float(score), 4),
            "match_quality": "Low",
            "suggestions": suggestions
        })


@app.route("/api/categories", methods=["GET"])
def api_categories():
    """Return all FAQ categories and their counts."""
    categories = get_all_categories()
    return jsonify({
        "success": True,
        "categories": categories
    })


@app.route("/api/faqs", methods=["GET"])
def api_faqs():
    """Return filtered FAQs by category or search query."""
    category = request.args.get("category", None)
    search_q = request.args.get("q", None)
    results = get_faqs(category=category, search_query=search_q)
    return jsonify({
        "success": True,
        "total": len(results),
        "faqs": results
    })


@app.route("/api/stats", methods=["GET"])
def api_stats():
    """Return FAQ Engine statistics and health info."""
    stats = get_engine_stats()
    return jsonify({
        "success": True,
        "stats": stats
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)