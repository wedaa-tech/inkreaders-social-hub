--
-- PostgreSQL database dump
--

\restrict BQOHI8b24v3pTlFTj3Tp8g9xfmjlKYf3EPjqxWwg4jOD9hgSXCB2AGPtF4C7bo1

-- Dumped from database version 14.19 (Homebrew)
-- Dumped by pg_dump version 14.19 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: app; Type: SCHEMA; Schema: -; Owner: ink
--

CREATE SCHEMA app;


ALTER SCHEMA app OWNER TO ink;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: app; Owner: ink
--

CREATE TABLE app.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider text NOT NULL,
    provider_account_id text NOT NULL,
    provider_type text,
    access_token text,
    refresh_token text,
    expires_at timestamp with time zone,
    scope text,
    token_type text,
    id_token text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    provider_data jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE app.accounts OWNER TO ink;

--
-- Name: exercise_attempts; Type: TABLE; Schema: app; Owner: ink
--

CREATE TABLE app.exercise_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exercise_id uuid NOT NULL,
    user_id uuid NOT NULL,
    answers jsonb,
    score numeric,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.exercise_attempts OWNER TO ink;

--
-- Name: exercise_sets; Type: TABLE; Schema: app; Owner: ink
--

CREATE TABLE app.exercise_sets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    format text NOT NULL,
    questions jsonb NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb,
    visibility text DEFAULT 'private'::text,
    parent_set_id uuid,
    at_uri text,
    cid text,
    feed_uri text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT exercise_sets_format_check CHECK ((format = ANY (ARRAY['mcq'::text, 'fill_blank'::text, 'true_false'::text, 'mixed'::text])))
);


ALTER TABLE app.exercise_sets OWNER TO ink;

--
-- Name: exercises; Type: TABLE; Schema: app; Owner: ink
--

CREATE TABLE app.exercises (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exercise_set_id uuid,
    user_id uuid NOT NULL,
    topic_id uuid,
    response_id uuid,
    title text,
    format text,
    questions jsonb,
    status text DEFAULT 'ready'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.exercises OWNER TO ink;

--
-- Name: files; Type: TABLE; Schema: app; Owner: ink
--

CREATE TABLE app.files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    mime text NOT NULL,
    storage_key text NOT NULL,
    pages integer,
    chars integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.files OWNER TO ink;

--
-- Name: follows; Type: TABLE; Schema: app; Owner: ink
--

CREATE TABLE app.follows (
    src_user_id uuid NOT NULL,
    dst_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.follows OWNER TO ink;

--
-- Name: highlights; Type: TABLE; Schema: app; Owner: ink
--

CREATE TABLE app.highlights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    topic_id uuid,
    response_id uuid,
    user_id uuid NOT NULL,
    excerpt text NOT NULL,
    color text DEFAULT 'yellow'::text,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.highlights OWNER TO ink;

--
-- Name: response_versions; Type: TABLE; Schema: app; Owner: ink
--

CREATE TABLE app.response_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    response_id uuid NOT NULL,
    version_number integer NOT NULL,
    content text,
    content_html text,
    raw jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.response_versions OWNER TO ink;

--
-- Name: responses; Type: TABLE; Schema: app; Owner: ink
--

CREATE TABLE app.responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    topic_id uuid,
    parent_response_id uuid,
    author_type text DEFAULT 'ai'::text NOT NULL,
    user_id uuid,
    content text,
    content_html text,
    raw jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    status text DEFAULT 'pending'::text
);


ALTER TABLE app.responses OWNER TO ink;

--
-- Name: sessions; Type: TABLE; Schema: app; Owner: ink
--

CREATE TABLE app.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    last_seen_at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.sessions OWNER TO ink;

--
-- Name: topics; Type: TABLE; Schema: app; Owner: ink
--

CREATE TABLE app.topics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    canonical_response_id uuid,
    tags jsonb DEFAULT '[]'::jsonb,
    meta jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.topics OWNER TO ink;

--
-- Name: user_counts; Type: TABLE; Schema: app; Owner: ink
--

CREATE TABLE app.user_counts (
    user_id uuid NOT NULL,
    followers integer DEFAULT 0,
    following integer DEFAULT 0,
    posts integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.user_counts OWNER TO ink;

--
-- Name: user_prefs; Type: TABLE; Schema: app; Owner: ink
--

CREATE TABLE app.user_prefs (
    user_id uuid NOT NULL,
    default_feed text DEFAULT 'app'::text,
    prefs jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.user_prefs OWNER TO ink;

--
-- Name: users; Type: TABLE; Schema: app; Owner: ink
--

CREATE TABLE app.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text,
    email_verified timestamp with time zone,
    name text,
    username text,
    avatar_url text,
    bio text,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.users OWNER TO ink;

--
-- Name: verification_tokens; Type: TABLE; Schema: app; Owner: ink
--

CREATE TABLE app.verification_tokens (
    identifier text NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


ALTER TABLE app.verification_tokens OWNER TO ink;

--
-- Data for Name: accounts; Type: TABLE DATA; Schema: app; Owner: ink
--

COPY app.accounts (id, user_id, provider, provider_account_id, provider_type, access_token, refresh_token, expires_at, scope, token_type, id_token, created_at, updated_at, provider_data) FROM stdin;
8ef7ba63-e704-41fa-a311-4937f06e2c51	f7d6aa58-8d70-4e3b-8eff-6404e572a52b	google	103021704985419955361	\N	2G/vt7ymh/OO9VLGRy7WQ7+XmoQ6JHmM/rH9TLBuxnlyAQNkC4kjXDZuqmcvaa/qTcDUQYK3/qE74oKdUa4wldpmAsS8FigemdGTYPEg4QJ5RKydi+LHBWyc8RSavkxbs12+6/sGozPbcBhtJ3ATSeuDUFhG9CG4AX/bohlBxJzv2cvTwpQ787sCQBeN6MYESGCYSXGXI/NW/612fp6M/DngBf01CdR37kBwjlbQMLzKXJEcd6fHJYohJnVnuR7fJFVqu/B7RCgdv1ZYCUtROei3JQ23LUOyfx34siWJObQBW1gRPrk6W7nWu0m6833E1Y1S6h7GZ6r8MjPycqiInQ5TEgrvR3gRRKenPF6eUtbQ0BqT3/erkPnl	cHmxuvYeF7EZNft6umrqvaOksFV84+mqNlMRjW9sXbywISR8HwESeUdBPlYAKFd40DVFEbabyIHcde9aH1AgoxU/kLwUT/e6P20r6gYZbtsUGKcErQjtHVBv+5IOfJqCyS1QNzMML+k00taak/s4c88IGUcTUMYADMgfS6pWpzQfqAs=	2025-10-02 09:58:28.39509+05:30	\N	\N	\N	2025-10-01 13:47:46.421445+05:30	2025-10-02 08:58:29.400011+05:30	{"id": "103021704985419955361", "name": "Praveen Mishra", "email": "cordialpraveen@gmail.com", "avatar": "https://lh3.googleusercontent.com/a/ACg8ocKV5JxtGMmVZdzYIlZGSH5sHYvcilWEUMd4RihdROO2OV0zSCE=s96-c", "oauth_scope": null, "last_refreshed_at": "2025-10-02T08:58:29+05:30", "refresh_fail_count": 0}
\.


--
-- Data for Name: exercise_attempts; Type: TABLE DATA; Schema: app; Owner: ink
--

COPY app.exercise_attempts (id, exercise_id, user_id, answers, score, created_at) FROM stdin;
\.


--
-- Data for Name: exercise_sets; Type: TABLE DATA; Schema: app; Owner: ink
--

COPY app.exercise_sets (id, user_id, title, format, questions, meta, visibility, parent_set_id, at_uri, cid, feed_uri, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: exercises; Type: TABLE DATA; Schema: app; Owner: ink
--

COPY app.exercises (id, exercise_set_id, user_id, topic_id, response_id, title, format, questions, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: files; Type: TABLE DATA; Schema: app; Owner: ink
--

COPY app.files (id, user_id, mime, storage_key, pages, chars, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: follows; Type: TABLE DATA; Schema: app; Owner: ink
--

COPY app.follows (src_user_id, dst_user_id, created_at) FROM stdin;
\.


--
-- Data for Name: highlights; Type: TABLE DATA; Schema: app; Owner: ink
--

COPY app.highlights (id, topic_id, response_id, user_id, excerpt, color, note, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: response_versions; Type: TABLE DATA; Schema: app; Owner: ink
--

COPY app.response_versions (id, response_id, version_number, content, content_html, raw, created_at) FROM stdin;
\.


--
-- Data for Name: responses; Type: TABLE DATA; Schema: app; Owner: ink
--

COPY app.responses (id, topic_id, parent_response_id, author_type, user_id, content, content_html, raw, created_at, updated_at, status) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: app; Owner: ink
--

COPY app.sessions (id, user_id, session_token, expires_at, created_at, last_seen_at) FROM stdin;
313347cc-718a-400c-8169-c4a06616c5cd	f7d6aa58-8d70-4e3b-8eff-6404e572a52b	f3550318-10b7-4de4-bc06-7fd62d5edc0d	2025-10-31 18:31:03.420834+05:30	2025-10-01 18:31:03.420943+05:30	2025-10-01 19:02:47.808398+05:30
80085d87-47de-41ec-b6aa-97593fb0f9f9	f7d6aa58-8d70-4e3b-8eff-6404e572a52b	cb95b6ef-8493-4846-b6c6-d8d9aa92f5aa	2025-10-31 19:02:58.093376+05:30	2025-10-01 19:02:58.093863+05:30	2025-10-01 19:03:06.022711+05:30
d6900d6f-227b-4e49-a5bc-2eb0d36a0767	f7d6aa58-8d70-4e3b-8eff-6404e572a52b	7edc8933-ab0b-4e74-b94f-b45c36d79fd0	2025-10-31 16:33:52.337254+05:30	2025-10-01 16:33:52.337888+05:30	2025-10-01 16:33:52.337888+05:30
be84d39f-9cbc-4ad8-a439-f916143ca7d3	f7d6aa58-8d70-4e3b-8eff-6404e572a52b	efbff19e-e09c-407d-b27c-0bce4863373c	2025-10-31 16:34:21.21748+05:30	2025-10-01 16:34:21.217882+05:30	2025-10-01 18:01:47.983414+05:30
1c333de4-0070-4fa9-a982-4564152e76d7	f7d6aa58-8d70-4e3b-8eff-6404e572a52b	82d9e3a4-c322-40b4-ab76-f160f7431985	2025-10-31 18:02:00.162511+05:30	2025-10-01 18:02:00.162858+05:30	2025-10-01 18:15:23.407424+05:30
e851ad71-2a8a-40ba-9455-f291b50005ea	f7d6aa58-8d70-4e3b-8eff-6404e572a52b	a166476b-6dc2-48a4-beaf-d3638d8243d6	2025-10-31 18:16:36.07626+05:30	2025-10-01 18:16:36.076693+05:30	2025-10-01 18:16:39.704934+05:30
b1b697cc-c781-46f8-a884-d434c3d381d3	f7d6aa58-8d70-4e3b-8eff-6404e572a52b	c373c465-ace9-4d8e-99c0-c2f4e9f05913	2025-10-31 16:20:56.805022+05:30	2025-10-01 16:20:56.805133+05:30	2025-10-01 16:20:56.805133+05:30
e9957dd6-6f43-4cb7-bfe2-aa501878ef2a	f7d6aa58-8d70-4e3b-8eff-6404e572a52b	eb580ae7-5625-42f7-a7ce-9fd48ec1a287	2025-10-31 18:26:45.923595+05:30	2025-10-01 18:26:45.923681+05:30	2025-10-01 18:29:16.122214+05:30
\.


--
-- Data for Name: topics; Type: TABLE DATA; Schema: app; Owner: ink
--

COPY app.topics (id, user_id, title, description, canonical_response_id, tags, meta, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_counts; Type: TABLE DATA; Schema: app; Owner: ink
--

COPY app.user_counts (user_id, followers, following, posts, updated_at) FROM stdin;
\.


--
-- Data for Name: user_prefs; Type: TABLE DATA; Schema: app; Owner: ink
--

COPY app.user_prefs (user_id, default_feed, prefs, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: app; Owner: ink
--

COPY app.users (id, email, email_verified, name, username, avatar_url, bio, metadata, is_active, created_at, updated_at) FROM stdin;
f7d6aa58-8d70-4e3b-8eff-6404e572a52b	cordialpraveen@gmail.com	\N	Praveen Mishra	praveen_mishra	https://lh3.googleusercontent.com/a/ACg8ocKV5JxtGMmVZdzYIlZGSH5sHYvcilWEUMd4RihdROO2OV0zSCE=s96-c	\N	{}	t	2025-10-01 13:47:46.416464+05:30	2025-10-01 13:47:46.416464+05:30
\.


--
-- Data for Name: verification_tokens; Type: TABLE DATA; Schema: app; Owner: ink
--

COPY app.verification_tokens (identifier, token, expires_at) FROM stdin;
\.


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_provider_provider_account_id_key; Type: CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.accounts
    ADD CONSTRAINT accounts_provider_provider_account_id_key UNIQUE (provider, provider_account_id);


--
-- Name: accounts accounts_user_id_provider_key; Type: CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.accounts
    ADD CONSTRAINT accounts_user_id_provider_key UNIQUE (user_id, provider);


--
-- Name: exercise_attempts exercise_attempts_pkey; Type: CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.exercise_attempts
    ADD CONSTRAINT exercise_attempts_pkey PRIMARY KEY (id);


--
-- Name: exercise_sets exercise_sets_pkey; Type: CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.exercise_sets
    ADD CONSTRAINT exercise_sets_pkey PRIMARY KEY (id);


--
-- Name: exercises exercises_pkey; Type: CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.exercises
    ADD CONSTRAINT exercises_pkey PRIMARY KEY (id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: follows follows_pkey; Type: CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.follows
    ADD CONSTRAINT follows_pkey PRIMARY KEY (src_user_id, dst_user_id);


--
-- Name: highlights highlights_pkey; Type: CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.highlights
    ADD CONSTRAINT highlights_pkey PRIMARY KEY (id);


--
-- Name: response_versions response_versions_pkey; Type: CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.response_versions
    ADD CONSTRAINT response_versions_pkey PRIMARY KEY (id);


--
-- Name: responses responses_pkey; Type: CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.responses
    ADD CONSTRAINT responses_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_session_token_key; Type: CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.sessions
    ADD CONSTRAINT sessions_session_token_key UNIQUE (session_token);


--
-- Name: topics topics_pkey; Type: CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.topics
    ADD CONSTRAINT topics_pkey PRIMARY KEY (id);


--
-- Name: user_counts user_counts_pkey; Type: CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.user_counts
    ADD CONSTRAINT user_counts_pkey PRIMARY KEY (user_id);


--
-- Name: user_prefs user_prefs_pkey; Type: CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.user_prefs
    ADD CONSTRAINT user_prefs_pkey PRIMARY KEY (user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: verification_tokens verification_tokens_pkey; Type: CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.verification_tokens
    ADD CONSTRAINT verification_tokens_pkey PRIMARY KEY (identifier, token);


--
-- Name: accounts_provider_provider_account_id_idx; Type: INDEX; Schema: app; Owner: ink
--

CREATE INDEX accounts_provider_provider_account_id_idx ON app.accounts USING btree (provider, provider_account_id);


--
-- Name: accounts_user_id_idx; Type: INDEX; Schema: app; Owner: ink
--

CREATE INDEX accounts_user_id_idx ON app.accounts USING btree (user_id);


--
-- Name: exercise_sets_user_id_created_at_idx; Type: INDEX; Schema: app; Owner: ink
--

CREATE INDEX exercise_sets_user_id_created_at_idx ON app.exercise_sets USING btree (user_id, created_at DESC);


--
-- Name: exercises_user_id_idx; Type: INDEX; Schema: app; Owner: ink
--

CREATE INDEX exercises_user_id_idx ON app.exercises USING btree (user_id);


--
-- Name: files_user_id_idx; Type: INDEX; Schema: app; Owner: ink
--

CREATE INDEX files_user_id_idx ON app.files USING btree (user_id);


--
-- Name: responses_topic_id_created_at_idx; Type: INDEX; Schema: app; Owner: ink
--

CREATE INDEX responses_topic_id_created_at_idx ON app.responses USING btree (topic_id, created_at DESC);


--
-- Name: sessions_session_token_idx; Type: INDEX; Schema: app; Owner: ink
--

CREATE INDEX sessions_session_token_idx ON app.sessions USING btree (session_token);


--
-- Name: accounts accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.accounts
    ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- Name: exercise_attempts exercise_attempts_exercise_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.exercise_attempts
    ADD CONSTRAINT exercise_attempts_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES app.exercises(id) ON DELETE CASCADE;


--
-- Name: exercise_attempts exercise_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.exercise_attempts
    ADD CONSTRAINT exercise_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- Name: exercise_sets exercise_sets_parent_set_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.exercise_sets
    ADD CONSTRAINT exercise_sets_parent_set_id_fkey FOREIGN KEY (parent_set_id) REFERENCES app.exercise_sets(id);


--
-- Name: exercise_sets exercise_sets_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.exercise_sets
    ADD CONSTRAINT exercise_sets_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- Name: exercises exercises_exercise_set_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.exercises
    ADD CONSTRAINT exercises_exercise_set_id_fkey FOREIGN KEY (exercise_set_id) REFERENCES app.exercise_sets(id) ON DELETE CASCADE;


--
-- Name: exercises exercises_response_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.exercises
    ADD CONSTRAINT exercises_response_id_fkey FOREIGN KEY (response_id) REFERENCES app.responses(id);


--
-- Name: exercises exercises_topic_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.exercises
    ADD CONSTRAINT exercises_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES app.topics(id);


--
-- Name: exercises exercises_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.exercises
    ADD CONSTRAINT exercises_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- Name: files files_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.files
    ADD CONSTRAINT files_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- Name: follows follows_dst_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.follows
    ADD CONSTRAINT follows_dst_user_id_fkey FOREIGN KEY (dst_user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- Name: follows follows_src_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.follows
    ADD CONSTRAINT follows_src_user_id_fkey FOREIGN KEY (src_user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- Name: highlights highlights_response_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.highlights
    ADD CONSTRAINT highlights_response_id_fkey FOREIGN KEY (response_id) REFERENCES app.responses(id) ON DELETE CASCADE;


--
-- Name: highlights highlights_topic_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.highlights
    ADD CONSTRAINT highlights_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES app.topics(id) ON DELETE CASCADE;


--
-- Name: highlights highlights_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.highlights
    ADD CONSTRAINT highlights_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- Name: response_versions response_versions_response_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.response_versions
    ADD CONSTRAINT response_versions_response_id_fkey FOREIGN KEY (response_id) REFERENCES app.responses(id) ON DELETE CASCADE;


--
-- Name: responses responses_topic_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.responses
    ADD CONSTRAINT responses_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES app.topics(id) ON DELETE CASCADE;


--
-- Name: responses responses_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.responses
    ADD CONSTRAINT responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id);


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- Name: topics topics_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.topics
    ADD CONSTRAINT topics_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- Name: user_counts user_counts_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.user_counts
    ADD CONSTRAINT user_counts_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- Name: user_prefs user_prefs_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: ink
--

ALTER TABLE ONLY app.user_prefs
    ADD CONSTRAINT user_prefs_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict BQOHI8b24v3pTlFTj3Tp8g9xfmjlKYf3EPjqxWwg4jOD9hgSXCB2AGPtF4C7bo1

