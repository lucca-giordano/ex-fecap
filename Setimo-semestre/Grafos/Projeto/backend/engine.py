import sys
import sqlite3
import json
import math
import os

def main():
    if len(sys.argv) < 2:
        print(json.dumps([]))
        return

    mode = "recommend"
    if sys.argv[1] == "feed":
        mode = "feed"
        target_user = int(sys.argv[2])
        limit = int(sys.argv[3]) if len(sys.argv) > 3 else 8
        offset = int(sys.argv[4]) if len(sys.argv) > 4 else 0
    else:
        try:
            target_user = int(sys.argv[1])
        except ValueError:
            print(json.dumps([]))
            return

    db_path = os.path.join(os.path.dirname(__file__), 'database.sqlite')
    if not os.path.exists(db_path):
        print(json.dumps([]))
        return

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("SELECT id, name FROM subjects")
    subject_names = {row[0]: row[1] for row in cur.fetchall()}

    cur.execute("SELECT id, name, profile_picture_url FROM users")
    user_info = {row[0]: {"name": row[1], "avatar": row[2]} for row in cur.fetchall()}

    cur.execute("SELECT follower_id, followed_id FROM followers")
    edges = cur.fetchall()
    
    # Filtro Estrito Bidirecional (Amizade Mútua)
    follows = set(edges)
    adj = {}
    for u, v in edges:
        if (u, v) in follows and (v, u) in follows:
            if u not in adj: adj[u] = set()
            if v not in adj: adj[v] = set()
            adj[u].add(v)
            adj[v].add(u)

    cur.execute("SELECT user_id, subject_id FROM user_interests")
    interests = {}
    for uid, sid in cur.fetchall():
        if uid not in interests: interests[uid] = set()
        interests[uid].add(sid)

    cur.execute("SELECT id FROM users")
    all_users = [row[0] for row in cur.fetchall()]

    if target_user not in adj:
        adj[target_user] = set()

    target_friends = adj[target_user]
    
    recommendations = []
    common_friends_adj = {}
    for candidate in all_users:
        if candidate == target_user:
            continue
        
        # Algoritmo 1: Adamic Adar (Topologia e Amigos em Comum)
        common_friends = target_friends.intersection(adj.get(candidate, set()))
        score_aa = 0.0
        for cf in common_friends:
            degree = len(adj.get(cf, set()))
            if degree > 1:
                score_aa += 1.0 / math.log(degree)
                
        # Algoritmo 2: Similaridade de Jaccard (Cruzamento de Interesses / Matérias)
        set_u = interests.get(target_user, set())
        set_c = interests.get(candidate, set())
        union_len = len(set_u.union(set_c))
        score_jac = len(set_u.intersection(set_c)) / union_len if union_len > 0 else 0.0
        
        # Merge de Pesos Reais Múltiplos
        final_score = (score_aa * 0.7) + (score_jac * 0.3)
        
        if len(set_u.intersection(set_c)) > 0 or len(common_friends) > 0:
            common = set_u.intersection(set_c)
            common_names = [subject_names.get(s, f"ID {s}") for s in common]
            common_friends_names = [user_info.get(cf, {}).get("name", f"ID {cf}") for cf in common_friends]
            
            recommendations.append({
                "candidate_id": candidate,
                "candidate_name": user_info.get(candidate, {}).get("name", f"User {candidate}"),
                "candidate_avatar": user_info.get(candidate, {}).get("avatar", ""),
                "score": round(final_score, 4),
                "adamic_adar_raw": round(score_aa, 4),
                "jaccard_raw": round(score_jac, 4),
                "common_interests": len(common),
                "common_subjects_names": common_names,
                "is_friend_of_friend": len(common_friends) > 0,
                "common_friends_names": common_friends_names
            })

    cur.execute("SELECT followed_id FROM followers WHERE follower_id = ?", (target_user,))
    target_following = set(row[0] for row in cur.fetchall())

    # Retorno dependente da arquitetura requisitada (Recomendação ou Feed Dinâmico Paginado)
    if mode == "recommend":
        # Excluir explícitamente pessoas que o alvo JÁ SEGUE da aba de Sugestões Inéditas
        recs = [r for r in recommendations if r['candidate_id'] not in target_following and r['candidate_id'] != target_user]
        recs.sort(key=lambda x: x['score'], reverse=True)
        print(json.dumps(recs[:10]))
        return

    # FOR FEED MODE: Construindo o Feed Infinito
    rec_tags = {}
    for r in recommendations:
        if r['common_interests'] > 0:
            rec_tags[r['candidate_id']] = f"Também gosta de {r['common_subjects_names'][0]}"
        elif r['is_friend_of_friend'] and len(r['common_friends_names']) > 0:
            rec_tags[r['candidate_id']] = f"Amigo de {r['common_friends_names'][0]}"
            
    # O Feed baseia-se em pessoas puramente seguidas + Recomendações Purificadas (Mutuals + Subjects)
    allowed_authors = target_following.union(set(rec_tags.keys())).union({target_user})
    
    if len(allowed_authors) == 0:
        print(json.dumps([]))
        return
        
    placeholders = ",".join("?" * len(allowed_authors))
    query = f"""
        SELECT p.id, p.content, p.title, p.created_at, p.user_id, u.name, u.username, u.profile_picture_url, s.name,
        (SELECT COUNT(*) FROM likes WHERE publication_id = p.id) as likesCount,
        (SELECT COUNT(*) FROM comments WHERE publication_id = p.id) as commentsCount
        FROM publications p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN subjects s ON p.subject_id = s.id
        WHERE p.user_id IN ({placeholders})
        ORDER BY RANDOM()
        LIMIT ? OFFSET ?
    """
    
    params = list(allowed_authors) + [limit, offset]
    cur.execute(query, params)
    
    feed_posts = []
    for row in cur.fetchall():
        author_id = row[4]
        is_me = author_id == target_user
        is_following = author_id in target_following and not is_me
        is_rec = author_id in rec_tags and not is_following and not is_me
        
        feed_posts.append({
            "id": row[0], "content": row[1], "title": row[2], "created_at": row[3],
            "author_id": row[4], "authorName": row[5], "authorHandle": row[6], "authorAvatar": row[7],
            "subjectName": row[8], "likesCount": row[9], "commentsCount": row[10],
            "isFollowing": is_following,
            "isRecommended": is_rec,
            "recommendationReason": rec_tags.get(author_id, "") if is_rec else ""
        })
        
    print(json.dumps(feed_posts))

if __name__ == '__main__':
    main()
