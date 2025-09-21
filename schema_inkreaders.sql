--
-- PostgreSQL database dump
--

\restrict 8maGhGbN1gFQRZ70bdWFTJb9PDqwkIPzWK1AaS2pHP11yh7DeGK0jvvDx8tu0N5

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
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: ir_visibility; Type: TYPE; Schema: public; Owner: ink
--

CREATE TYPE public.ir_visibility AS ENUM (
    'private',
    'unlisted',
    'public'
);


ALTER TYPE public.ir_visibility OWNER TO ink;

--
-- Name: shelf_status; Type: TYPE; Schema: public; Owner: praveenmishra
--

CREATE TYPE public.shelf_status AS ENUM (
    'want',
    'reading',
    'finished'
);


ALTER TYPE public.shelf_status OWNER TO praveenmishra;

--
-- Name: create_response_version_trigger(); Type: FUNCTION; Schema: public; Owner: ink
--

CREATE FUNCTION public.create_response_version_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  ver integer;
BEGIN
  -- only create a version when content or content_html or raw changes:
  IF (OLD.content IS NOT DISTINCT FROM NEW.content AND
      OLD.content_html IS NOT DISTINCT FROM NEW.content_html AND
      OLD.raw IS NOT DISTINCT FROM NEW.raw) THEN
    RETURN NEW; -- nothing changed relevant, skip
  END IF;

  ver := next_response_version_num(OLD.id);
  INSERT INTO response_versions(response_id, version_number, content, content_html, raw, created_at)
    VALUES (OLD.id, ver, OLD.content, OLD.content_html, OLD.raw, now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.create_response_version_trigger() OWNER TO ink;

--
-- Name: next_response_version_num(uuid); Type: FUNCTION; Schema: public; Owner: ink
--

CREATE FUNCTION public.next_response_version_num(resp_id uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  v integer;
BEGIN
  SELECT COALESCE(max(version_number), 0) + 1 INTO v FROM response_versions WHERE response_id = resp_id;
  RETURN v;
END;
$$;


ALTER FUNCTION public.next_response_version_num(resp_id uuid) OWNER TO ink;

--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: ink
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.touch_updated_at() OWNER TO ink;

--
-- Name: update_responses_search_vector(); Type: FUNCTION; Schema: public; Owner: ink
--

CREATE FUNCTION public.update_responses_search_vector() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.search_vector := setweight(to_tsvector('english', coalesce(NEW.content, '')), 'B');
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_responses_search_vector() OWNER TO ink;

--
-- Name: update_topics_search_vector(); Type: FUNCTION; Schema: public; Owner: ink
--

CREATE FUNCTION public.update_topics_search_vector() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.meta->>'summary','')), 'C');
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_topics_search_vector() OWNER TO ink;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: ink
--

CREATE TABLE public.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    did text NOT NULL,
    handle text NOT NULL,
    display_name text,
    avatar_url text,
    pds_base text DEFAULT 'https://bsky.social'::text NOT NULL,
    access_jwt bytea NOT NULL,
    refresh_jwt bytea NOT NULL,
    session_expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    bio text
);


ALTER TABLE public.accounts OWNER TO ink;

--
-- Name: bookmarks; Type: TABLE; Schema: public; Owner: ink
--

CREATE TABLE public.bookmarks (
    user_id uuid NOT NULL,
    post_uri text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.bookmarks OWNER TO ink;

--
-- Name: books; Type: TABLE; Schema: public; Owner: ink
--

CREATE TABLE public.books (
    id bigint NOT NULL,
    isbn10 text,
    isbn13 text,
    title text NOT NULL,
    authors text[] DEFAULT '{}'::text[],
    link text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.books OWNER TO ink;

--
-- Name: books_id_seq; Type: SEQUENCE; Schema: public; Owner: ink
--

CREATE SEQUENCE public.books_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.books_id_seq OWNER TO ink;

--
-- Name: books_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ink
--

ALTER SEQUENCE public.books_id_seq OWNED BY public.books.id;


--
-- Name: cursors; Type: TABLE; Schema: public; Owner: ink
--

CREATE TABLE public.cursors (
    name text NOT NULL,
    value text NOT NULL
);


ALTER TABLE public.cursors OWNER TO ink;

--
-- Name: events; Type: TABLE; Schema: public; Owner: ink
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone,
    location text,
    url text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.events OWNER TO ink;

--
-- Name: exercise_attempts; Type: TABLE; Schema: public; Owner: ink
--

CREATE TABLE public.exercise_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exercise_id uuid NOT NULL,
    user_id uuid NOT NULL,
    answers jsonb,
    score numeric,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.exercise_attempts OWNER TO ink;

--
-- Name: exercise_sets; Type: TABLE; Schema: public; Owner: ink
--

CREATE TABLE public.exercise_sets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    format text NOT NULL,
    questions jsonb NOT NULL,
    meta jsonb NOT NULL,
    visibility public.ir_visibility DEFAULT 'private'::public.ir_visibility NOT NULL,
    parent_set_id uuid,
    at_uri text,
    cid text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    feed_uri text,
    CONSTRAINT exercise_sets_format_check CHECK ((format = ANY (ARRAY['mcq'::text, 'fill_blank'::text, 'true_false'::text, 'mixed'::text])))
);


ALTER TABLE public.exercise_sets OWNER TO ink;

--
-- Name: exercises; Type: TABLE; Schema: public; Owner: ink
--

CREATE TABLE public.exercises (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
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


ALTER TABLE public.exercises OWNER TO ink;

--
-- Name: files; Type: TABLE; Schema: public; Owner: ink
--

CREATE TABLE public.files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    mime text NOT NULL,
    storage_key text NOT NULL,
    pages integer,
    chars integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.files OWNER TO ink;

--
-- Name: follows; Type: TABLE; Schema: public; Owner: ink
--

CREATE TABLE public.follows (
    src_did text NOT NULL,
    dst_did text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.follows OWNER TO ink;

--
-- Name: highlights; Type: TABLE; Schema: public; Owner: ink
--

CREATE TABLE public.highlights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    topic_id uuid NOT NULL,
    response_id uuid NOT NULL,
    user_id uuid NOT NULL,
    excerpt text NOT NULL,
    color text DEFAULT 'yellow'::text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.highlights OWNER TO ink;

--
-- Name: jobs; Type: TABLE; Schema: public; Owner: ink
--

CREATE TABLE public.jobs (
    id bigint NOT NULL,
    job_type text NOT NULL,
    payload jsonb NOT NULL,
    state text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    last_error text,
    locked_at timestamp with time zone,
    run_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.jobs OWNER TO ink;

--
-- Name: jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: ink
--

CREATE SEQUENCE public.jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.jobs_id_seq OWNER TO ink;

--
-- Name: jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ink
--

ALTER SEQUENCE public.jobs_id_seq OWNED BY public.jobs.id;


--
-- Name: posts; Type: TABLE; Schema: public; Owner: ink
--

CREATE TABLE public.posts (
    uri text NOT NULL,
    cid text NOT NULL,
    did text NOT NULL,
    collection text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    text text,
    rating real,
    progress real,
    book_id bigint,
    article_url text,
    article_title text,
    article_source text
);


ALTER TABLE public.posts OWNER TO ink;

--
-- Name: response_versions; Type: TABLE; Schema: public; Owner: ink
--

CREATE TABLE public.response_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    response_id uuid NOT NULL,
    version_number integer NOT NULL,
    content text,
    content_html text,
    raw jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.response_versions OWNER TO ink;

--
-- Name: responses; Type: TABLE; Schema: public; Owner: ink
--

CREATE TABLE public.responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    topic_id uuid NOT NULL,
    parent_response_id uuid,
    author_type text DEFAULT 'ai'::text NOT NULL,
    content text,
    content_html text,
    raw jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    search_vector tsvector,
    embedding public.vector(1536),
    status text DEFAULT 'pending'::text,
    embedding_json jsonb,
    CONSTRAINT responses_author_type_check CHECK ((author_type = ANY (ARRAY['ai'::text, 'user'::text])))
);


ALTER TABLE public.responses OWNER TO ink;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: ink
--

CREATE TABLE public.sessions (
    id uuid NOT NULL,
    account_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sessions OWNER TO ink;

--
-- Name: shelves; Type: TABLE; Schema: public; Owner: ink
--

CREATE TABLE public.shelves (
    user_id uuid NOT NULL,
    book_isbn text,
    book_title text NOT NULL,
    book_authors text[] DEFAULT '{}'::text[] NOT NULL,
    status public.shelf_status NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.shelves OWNER TO ink;

--
-- Name: topics; Type: TABLE; Schema: public; Owner: ink
--

CREATE TABLE public.topics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    canonical_response_id uuid,
    tags jsonb DEFAULT '[]'::jsonb,
    meta jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    search_vector tsvector,
    embedding public.vector(1536),
    embedding_json jsonb
);


ALTER TABLE public.topics OWNER TO ink;

--
-- Name: user_counts; Type: TABLE; Schema: public; Owner: ink
--

CREATE TABLE public.user_counts (
    did text NOT NULL,
    followers integer DEFAULT 0 NOT NULL,
    following integer DEFAULT 0 NOT NULL,
    posts integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_counts OWNER TO ink;

--
-- Name: user_prefs; Type: TABLE; Schema: public; Owner: ink
--

CREATE TABLE public.user_prefs (
    user_id uuid NOT NULL,
    default_feed text DEFAULT 'app'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_prefs OWNER TO ink;

--
-- Name: users; Type: TABLE; Schema: public; Owner: ink
--

CREATE TABLE public.users (
    did text NOT NULL,
    handle text,
    display_name text,
    bio text,
    avatar_url text,
    banner_url text,
    indexed_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.users OWNER TO ink;

--
-- Name: books id; Type: DEFAULT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.books ALTER COLUMN id SET DEFAULT nextval('public.books_id_seq'::regclass);


--
-- Name: jobs id; Type: DEFAULT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.jobs ALTER COLUMN id SET DEFAULT nextval('public.jobs_id_seq'::regclass);


--
-- Data for Name: accounts; Type: TABLE DATA; Schema: public; Owner: ink
--

COPY public.accounts (id, did, handle, display_name, avatar_url, pds_base, access_jwt, refresh_jwt, session_expires_at, created_at, updated_at, bio) FROM stdin;
268a0026-45cd-41d8-9458-4c7874b22ba6	did:plc:matwoj635dvtorkqxgzw7sti	inkreaders.com	Ink Reader		https://bsky.social	\\xfb2af1e8d277cbe1fa49c75dc24b7b81ce17bcedf502a8450114bbf49917e583829e87aa46535ba5b88e6a796fe5790d0c905e1fa1231808474d2fb4962717ff9f4b9ac41eaea93a8643fce356f97c3aebecb54c64907d49e4baf173b7606f4dc768a5647bac1a1f8faf63ec66cbd911917f7bab63dab9cebd7dc4058c3338518a318b89c4cd6add510494f49588f2c2afb0cd3ba5acb8e4ae5d0b7438c59ae9394c5bd32ee597c7179b9e23263d029fe4ff4e30f3ec793e92bf43ab01554fe65b63ee5656b72c378f5e1e8fdf05c02a2681b60af180391969a41cb7b724fc37aa68d1fd35a922f4db17b0caa70edb3e07baa0e87be6b12179307bb1780a9db07625b580e0b99aa3f6911e25a31fd42fd52874d7f6da439b48d1793912ed41c3f97ef72281bfffca20b961f73f30cb09d0bbd0ae6ab4ea4b937937b2b30209ea6f2d0108d3e64d4de1023d708c6ba06d003468eab4002c2cc52f96be2c892d09898f64ec771bbb75ed1f4f6212e6	\\x9bbd0ef1d77d8a4514b31fbb5a74edb1a127bceb287779558fe2224644d2865b0e336738b98321f0028a7ff99bb8d5e7da2e4814f25afe8c8dcaafd83928055b54d31fdeefdf60ae6d41b1f3e921373e15c1398b5c1e4f1584b1c86a14e0eb2b58fd11db5984e8bf4b632996b2d93793f21293421c179e56abb9385e776070947ebe5ae30f007c727d3c770499984532d2b32bf49523c186ca1927d9db56d26189aa1ef7e26b492f07b12c109b60a2ec3dac73d0d4072b11693b643098bd1eb824547d45c43d65db13a5986601090c7a57f3ec165bacc9cc7e9a2e986ab8a876d03e341a1b259ef96def2babd7f5b5e0511f2cc961a5b54137d395284046a3ebefb5497b2e7d4140d072de84497c0a527480e908fbda7c5ea1597392ddf28a464edadd2a8cbbfb4ad186808761449b3ddb87e25b6660f3aebeb07bd4f3797542545cbf0d5d8a0a4dbefffbecaac7a233fd8846edaff7ae6bd2ce2bc01aa8bbaeab77300ccbb721a1364236dccd2be5062c1e8fd91850ba45961cdfa3fe6683fcc561b1966ba5e7cd5ae16991928059017f2baa6dad4930c9833cf31e	2025-09-16 03:20:46.488577+05:30	2025-08-28 15:35:43.392682+05:30	2025-09-15 21:20:46.506523+05:30	Love books!
29c27c16-89fa-4f73-941e-29c722ed7979	did:plc:km2nrwo7d6p3x3j5z5mmg6jl	praveen-mishra.bsky.social			https://bsky.social	\\x5740c066c34261a64d7c4da1dbbfb840ea39b4fc737607f8925fa87b1786f5cf4a77b409e99bcead4fa15613c221f3b6cb583c0ff22be943ccbeb67678866b590bdb99d24725b634f825475cceb9b615ff8dba23e020cc854e3bac51de14a303e1a1616207b326b7cf5141c0134cd8aff985a853bce980de6283155724fb6482e5514c53d938f5cf97dae86f9bc4bdc71369c371ae33a7d90688fd8edad9222856862477fc1b13801028d0183e723aed9f3fb5b9f1855248ba17e7561230e533978a4277ecd208f71f81c60d78fe0fd11c5ad8bd42ebe14ff712bcedaa6e99ee9caba2c36db3da9f3f920304c447db20424f9cd660a40076fcbffd0416313385be79c3be94ccf1bbc2ae98b7ea0dd6f34330245756ad811e9d6030d1d2d9911a7d2611a72a02e7abbf67cd765fe4e2e477cba7cabdce4f24c7f9dd1134d669bd395b493f9c2535158ca27ca392d077eb3534839ef32f9821d2d34c1cc6efbccfa9dec9beb8b2a1313022be026a107e8ad761c09d0c28b080ee724c99	\\x1ebaa725deed76f2ed516a75f606ff8f9e784ac050cd2fc3b4054cf12988fcecd31453e84ec8eca4ece49aba2d6ebcc71d3fcc5a396a89c6b7d666c7722be609c2bc997d2b4b7421931ce447da88a85a7486edb8bfad2c296739dcf615e8e32f090eca88e701ee950909e29cbf3957245aa26e43b4cc308be3f8900bbec55f3c2344adf7508f3cf1a61a551247351646faf5a825f2f7f1271421038551dd7ec10936a0a39d5262c8260859af3844e408f86d317bf94df833a8119cfff092703057dacb7f4918316113bd404ebfc7544e90e9bfcb70b6457c62afd5f0a82946ebd138d8d74884f8bb247dda870a9f209987b48ef7c823ddfdb69d7933b81765a5f680976f515c41b07726b283007c4a5e06763fb63c8f0bda5766b83761958546e2aa41a4ac882d300a9831c451b3c61f5fe64cf3b88bfc8b4afb9959e0b1106fa27c5d952f1c5ebda12d9a27404ac3837e39775985c750bb30874b8e17200e56dc683f1f7d8a890d2d14c23e22e4659a5cf6aaefe79a35d64241e638a7d237d1c07e7fbdb5ab4c331bbf5ae159143630efb7e413459b017b67b95ac8	2025-09-21 23:39:39.124905+05:30	2025-08-29 12:53:42.305629+05:30	2025-09-21 17:39:39.126217+05:30	\N
\.


--
-- Data for Name: bookmarks; Type: TABLE DATA; Schema: public; Owner: ink
--

COPY public.bookmarks (user_id, post_uri, created_at) FROM stdin;
\.


--
-- Data for Name: books; Type: TABLE DATA; Schema: public; Owner: ink
--

COPY public.books (id, isbn10, isbn13, title, authors, link, created_at) FROM stdin;
17		\N	Test Book	{Someone}		2025-08-24 16:36:31.045517+05:30
18		\N	BookName	{BookAuthor}		2025-08-24 16:36:31.048377+05:30
19		\N	Debugging with Go	{You}		2025-08-24 16:36:31.049804+05:30
20		\N	Call Me Once	{MunsiTikamlal}		2025-08-24 16:36:31.052333+05:30
1		9780201616224	The Pragmatic Programmer	{"Andrew Hunt","David Thomas"}	https://example.com	2025-08-22 10:01:43.539675+05:30
111		\N	ChaloGhar	{Balua}		2025-08-24 20:30:02.234906+05:30
31		\N	InkReaders MVP	{You}		2025-08-24 16:39:34.600398+05:30
114		\N	Chalo Gawon	{Bhola}		2025-08-24 20:30:42.114134+05:30
162		\N	The one who walks faster	{T.PK}		2025-08-24 20:46:22.258218+05:30
\.


--
-- Data for Name: cursors; Type: TABLE DATA; Schema: public; Owner: ink
--

COPY public.cursors (name, value) FROM stdin;
poll:book	3lwvy3voc3h2b
poll:article	3lx4qyr7on42n
\.


--
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: ink
--

COPY public.events (id, title, starts_at, ends_at, location, url, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: exercise_attempts; Type: TABLE DATA; Schema: public; Owner: ink
--

COPY public.exercise_attempts (id, exercise_id, user_id, answers, score, created_at) FROM stdin;
\.


--
-- Data for Name: exercise_sets; Type: TABLE DATA; Schema: public; Owner: ink
--

COPY public.exercise_sets (id, user_id, title, format, questions, meta, visibility, parent_set_id, at_uri, cid, created_at, updated_at, feed_uri) FROM stdin;
6e7dccd9-7848-4f35-bfce-6ca692eed3c7	268a0026-45cd-41d8-9458-4c7874b22ba6	Demo	mcq	[{"q": "1+1?", "type": "", "answer": "2", "options": ["1", "2"]}]	{"source": {"type": "topic", "topic": "math"}, "language": "en", "difficulty": "easy"}	private	\N	at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.exercise.post/3lxnzu7yz4k24	bafyreib45dpcfnhvqwdixmphlby637jts6em4yew2qj7mpdnrxqdinydca	2025-08-31 07:52:58.104681+05:30	2025-08-31 07:54:29.452772+05:30	\N
8e7a8747-40fa-4c80-b99a-f7594a1f9769	268a0026-45cd-41d8-9458-4c7874b22ba6	Space Exploration Quiz	mcq	[{"q": "Which country launched Chandrayaan-3?", "type": "mcq", "answer": "India", "explain": "ISRO is the Indian space agency.", "options": ["India", "USA", "Russia"]}]	{"source": {"type": "topic", "topic": "Chandrayaan"}, "language": "en", "difficulty": "easy"}	private	\N	at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.exercise.post/3lxquuczcd424	bafyreifknhdkdlxiglls23qocujyb7o57rk54uobyqekuiwegmnhhbm6we	2025-09-01 11:01:21.8348+05:30	2025-09-01 11:03:03.055433+05:30	\N
5f5ca935-e495-4924-aad5-62d9a89a50a4	268a0026-45cd-41d8-9458-4c7874b22ba6	Democracy	mcq	[{"q": "What is democracy?", "type": "mcq", "answer": "A", "explain": "Democracy is a system of government where the citizens exercise power directly or elect representatives.", "options": ["A system of government by the whole population", "A type of monarchy", "A form of dictatorship", "A military rule"]}, {"q": "Which of the following is a key feature of democracy?", "type": "mcq", "answer": "A", "explain": "Free and fair elections are essential for a functioning democracy, allowing citizens to choose their leaders.", "options": ["Free and fair elections", "Censorship of the press", "Limited public participation", "One-party rule"]}, {"q": "In a democracy, who has the ultimate authority?", "type": "mcq", "answer": "C", "explain": "In a democracy, the ultimate authority rests with the citizens who elect their representatives.", "options": ["The government", "The military", "The citizens", "The monarchy"]}, {"q": "What is the term for a government elected by the people?", "type": "mcq", "answer": "B", "explain": "Democracy refers to a government system where officials are elected by the people.", "options": ["Oligarchy", "Democracy", "Autocracy", "Plutocracy"]}, {"q": "Which document often outlines the principles of democracy?", "type": "mcq", "answer": "A", "explain": "A constitution typically outlines the principles and framework of a democratic government.", "options": ["Constitution", "Manifesto", "Treaty", "Decree"]}]	{"source": {"type": "topic", "topic": "Democracy"}, "language": "en", "difficulty": "easy"}	private	\N	at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.exercise.post/3lxr25sdoaq2s	bafyreicpt3xjloxw5n6l2lp4iymknbk4zudd346qzq3ufqztk5htfo7ana	2025-09-01 12:37:45.679965+05:30	2025-09-01 12:37:49.779179+05:30	\N
ac0b656e-bd84-4d2f-a47d-28bad6137955	268a0026-45cd-41d8-9458-4c7874b22ba6	Indian Ocean	mcq	[{"q": "What is the capital of France?", "type": "mcq", "answer": "C", "explain": "Paris is the capital city of France.", "options": ["Berlin", "Madrid", "Paris", "Rome"]}, {"q": "Which planet is known as the Red Planet?", "type": "mcq", "answer": "B", "explain": "Mars is commonly referred to as the Red Planet due to its reddish appearance.", "options": ["Earth", "Mars", "Jupiter", "Venus"]}]	{"source": {"type": "topic"}, "language": "en", "difficulty": "easy"}	private	\N	at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.exercise.post/3lxrn3bh2ni2s	bafyreifjh7mopfotch6dwbwlegldmjbq4xvlfwkwoz2375dg2nuayadwou	2025-09-01 16:58:17.837784+05:30	2025-09-01 18:16:26.6577+05:30	
c5176462-2716-49a6-83ea-6a58724a3de1	268a0026-45cd-41d8-9458-4c7874b22ba6	Current Affairs Quiz	mcq	[{"q": "Who launched Chandrayaan-3?", "type": "", "answer": "ISRO", "options": ["NASA", "ISRO", "ESA"]}]	{"source": {"type": "topic", "topic": "Space"}, "language": "en", "difficulty": "easy"}	private	\N	at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.exercise.post/3lxrna2kfbx2q	bafyreidesv5io5a2wkxc7jyqyi25x2njpqr63tubl3iy6iajhmkv65ig2i	2025-08-31 06:25:45.870663+05:30	2025-09-01 18:19:07.120993+05:30	
72737206-df93-4e1e-ad88-180287351605	268a0026-45cd-41d8-9458-4c7874b22ba6	Himalaya	mcq	[{"q": "What is the highest peak in the Himalayas?", "type": "mcq", "answer": "C", "explain": "Mount Everest is the highest peak in the Himalayas and the world.", "options": ["K2", "Kangchenjunga", "Mount Everest", "Lhotse"]}, {"q": "Which countries are home to the Himalayas?", "type": "mcq", "answer": "A", "explain": "The Himalayas stretch across India, China, and Nepal.", "options": ["India, China, Nepal", "Brazil, Argentina, Chile", "USA, Canada, Mexico", "Russia, Japan, South Korea"]}]	{"source": {"type": "topic", "topic": "Himalaya"}, "language": "en", "difficulty": "easy"}	private	\N	at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.exercise.post/3lxroufy3wj2g	bafyreie5zzo72sgeyezvs5lexls6shfypzqp364jretlbkodyi6fquprwq	2025-09-01 18:48:20.052026+05:30	2025-09-01 18:48:23.919052+05:30	\N
39d89064-f7fa-4f86-8ee0-556e0c1a9313	268a0026-45cd-41d8-9458-4c7874b22ba6	Class 2 Reading	mcq	[{"q": "What is the main character's name in the story?", "type": "mcq", "answer": "Tom", "explain": "The main character is introduced as Tom in the beginning of the story.", "options": ["Tom", "Jerry", "Sam", "Anna"]}, {"q": "What did the character find in the garden?", "type": "mcq", "answer": "A flower", "explain": "The character discovers a beautiful flower while exploring the garden.", "options": ["A toy", "A book", "A flower", "A bird"]}]	{"source": {"type": "topic", "topic": "Class 2 Reading"}, "language": "en", "difficulty": "easy"}	private	\N	at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.exercise.post/3lxs2rutq3k2q	bafyreiabwp43dqscp3lm5sjrws5kolzfadbxmpveuqh2jyh5f5pov5lt6e	2025-09-01 22:21:14.78256+05:30	2025-09-01 22:21:43.826869+05:30	\N
e67cef0a-daba-4bf9-87d9-85bf82518d0a	29c27c16-89fa-4f73-941e-29c722ed7979	Reptile	mcq	[{"q": "", "type": "mcq", "answer": null, "options": ["A. They are cold-blooded", "B. They lay eggs", "C. They have feathers", "D. They have scales"]}, {"q": "", "type": "mcq", "answer": null, "options": ["A. To aid in flight", "B. To retain moisture", "C. To provide warmth", "D. To assist in swimming"]}, {"q": "", "type": "mcq", "answer": null, "options": ["A. Iguana", "B. Chameleon", "C. Gecko", "D. Komodo Dragon"]}]	{"source": {"type": ""}, "language": "", "difficulty": ""}	private	\N			2025-09-03 17:42:15.633161+05:30	2025-09-03 17:42:15.633161+05:30	\N
c4216df3-e80c-4515-af15-28d1f0faccb3	268a0026-45cd-41d8-9458-4c7874b22ba6	Indian Mythology	mcq	[{"q": "Who is considered the king of the gods in Hindu mythology?", "type": "mcq", "answer": "A", "explain": "Indra is known as the king of the gods and the ruler of heaven in Hindu mythology.", "options": ["Indra", "Brahma", "Vishnu", "Shiva"]}, {"q": "Which epic features the character of Rama?", "type": "mcq", "answer": "B", "explain": "The Ramayana is the epic that narrates the life and adventures of Rama.", "options": ["Mahabharata", "Ramayana", "Puranas", "Vedas"]}, {"q": "What is the name of the goddess of wealth and prosperity in Hinduism?", "type": "mcq", "answer": "C", "explain": "Lakshmi is the goddess of wealth, fortune, and prosperity in Hindu mythology.", "options": ["Saraswati", "Durga", "Lakshmi", "Parvati"]}, {"q": "Which demon king was defeated by Lord Rama?", "type": "mcq", "answer": "A", "explain": "Ravana was the demon king of Lanka who was defeated by Lord Rama in the Ramayana.", "options": ["Ravana", "Hiranyakashipu", "Kumbhakarna", "Mahishasura"]}, {"q": "In Hindu mythology, who is known as the destroyer of the universe?", "type": "mcq", "answer": "C", "explain": "Shiva is known as the destroyer and transformer within the Trimurti of Hinduism.", "options": ["Brahma", "Vishnu", "Shiva", "Ganesha"]}]	{"source": {"type": "topic", "topic": "Indian Mythology"}, "language": "en", "difficulty": "mixed"}	private	\N	at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.exercise.post/3lxs3znxqpg26	bafyreiawd6ngp6zb6kemhhlc3viycvlbib7kjj46my56ccwg2zjdv7j4vy	2025-09-01 22:43:29.314861+05:30	2025-09-01 22:43:58.735383+05:30	\N
564e1bf7-1dd5-4812-ba6d-6adf9021ed1a	268a0026-45cd-41d8-9458-4c7874b22ba6	Indian States	mcq	[{"q": "Which Indian state is known as the 'Land of Five Rivers'?", "type": "mcq", "answer": "A", "explain": "Punjab means 'Land of Five Rivers' in Persian.", "options": ["Punjab", "Haryana", "Gujarat", "Maharashtra"]}, {"q": "Which state is the largest in India by area?", "type": "mcq", "answer": "C", "explain": "Rajasthan is the largest state in India by area.", "options": ["Madhya Pradesh", "Uttar Pradesh", "Rajasthan", "Maharashtra"]}, {"q": "Which Indian state is famous for its backwaters?", "type": "mcq", "answer": "B", "explain": "Kerala is renowned for its scenic backwaters.", "options": ["Goa", "Kerala", "Tamil Nadu", "Andhra Pradesh"]}, {"q": "Which state is known for the dance form 'Bharatanatyam'?", "type": "mcq", "answer": "C", "explain": "Bharatanatyam is a classical dance form that originated in Tamil Nadu.", "options": ["Kerala", "Karnataka", "Tamil Nadu", "Andhra Pradesh"]}, {"q": "Which state has the highest literacy rate in India?", "type": "mcq", "answer": "A", "explain": "Kerala has the highest literacy rate among Indian states.", "options": ["Kerala", "Maharashtra", "Delhi", "Himachal Pradesh"]}]	{"source": {"type": "topic", "topic": "Indian States"}, "language": "en", "difficulty": "mixed"}	private	\N	at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.exercise.post/3lxtg3k4ux52n	bafyreihd7uiq3mbborjprbtcltvns4tg5cznr3tgulspkg5husxgcvdnpe	2025-09-02 11:16:35.599454+05:30	2025-09-02 11:16:38.946739+05:30	at://did:plc:matwoj635dvtorkqxgzw7sti/app.bsky.feed.post/3lxtg3klilg2u
7f921f3b-57f0-48f9-a064-4c94ba8801b2	268a0026-45cd-41d8-9458-4c7874b22ba6	World Politics 	mcq	[{"q": "Which organization was founded in 1945 to promote international cooperation and maintain peace?", "type": "mcq", "answer": "B", "explain": "The United Nations was established in 1945 to foster international cooperation and prevent conflicts.", "options": ["NATO", "United Nations", "European Union", "World Trade Organization"]}, {"q": "What is the primary purpose of the North Atlantic Treaty Organization (NATO)?", "type": "mcq", "answer": "B", "explain": "NATO is primarily a military alliance formed for collective defense against aggression.", "options": ["Economic cooperation", "Military alliance", "Cultural exchange", "Environmental protection"]}, {"q": "Which country is a permanent member of the United Nations Security Council?", "type": "mcq", "answer": "C", "explain": "Russia is one of the five permanent members of the UN Security Council, holding veto power.", "options": ["Germany", "India", "Russia", "Brazil"]}, {"q": "What event is often cited as the start of the Cold War?", "type": "mcq", "answer": "C", "explain": "The Berlin Blockade in 1948-1949 is often considered the beginning of the Cold War tensions.", "options": ["World War II", "The Cuban Missile Crisis", "The Berlin Blockade", "The Korean War"]}, {"q": "Which of the following countries is NOT a member of the European Union?", "type": "mcq", "answer": "B", "explain": "Norway is not a member of the European Union, although it is part of the European Economic Area.", "options": ["France", "Norway", "Italy", "Spain"]}]	{"source": {"type": "topic", "topic": "World Politics "}, "language": "en", "difficulty": "mixed"}	private	\N	at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.exercise.post/3lxtipqjdml27	bafyreieacyeyquvfiajvz6jcvyhdnihsuzcwh2qj56mevrmdzi4ewxn7ua	2025-09-02 12:03:41.050216+05:30	2025-09-02 12:03:44.115949+05:30	at://did:plc:matwoj635dvtorkqxgzw7sti/app.bsky.feed.post/3lxtipqtnka2x
6ff90e3e-0b0d-4a5a-85c5-7f14786bfbf8	29c27c16-89fa-4f73-941e-29c722ed7979	Conditional Probability	true_false	[{"id": "q1", "type": "true_false", "prompt": "If two events A and B are independent, then P(A | B) = P(A).", "explanation": "This is true because independence means the occurrence of B does not affect the probability of A.", "correct_answer": "true"}, {"id": "q2", "type": "true_false", "prompt": "The conditional probability P(A | B) can be greater than 1.", "explanation": "Conditional probabilities are always between 0 and 1.", "correct_answer": "false"}, {"id": "q3", "type": "true_false", "prompt": "If P(B) = 0, then P(A | B) is defined.", "explanation": "P(A | B) is undefined when P(B) = 0 because you cannot condition on an event with zero probability.", "correct_answer": "false"}]	{"source": {"type": ""}, "language": "", "difficulty": ""}	private	\N	\N	\N	2025-09-06 10:01:52.442033+05:30	2025-09-06 10:01:52.442033+05:30	\N
5ba3f9b8-7da2-48c5-8253-cdcbcc0ec2bf	268a0026-45cd-41d8-9458-4c7874b22ba6	Amazon Forest	mcq	[{"q": "What is the primary reason for deforestation in the Amazon Rainforest?", "type": "mcq", "answer": "A", "explain": "Agriculture, particularly cattle ranching and soy production, is the leading cause of deforestation in the Amazon.", "options": ["Agriculture", "Urbanization", "Tourism", "Mining"]}, {"q": "Which river flows through the Amazon Rainforest?", "type": "mcq", "answer": "B", "explain": "The Amazon River is the largest river in the world by discharge and flows through the Amazon Rainforest.", "options": ["Nile", "Amazon", "Yangtze", "Mississippi"]}, {"q": "What percentage of the world's biodiversity is found in the Amazon Rainforest?", "type": "mcq", "answer": "B", "explain": "The Amazon Rainforest is home to about 20% of the world's biodiversity.", "options": ["10%", "20%", "30%", "50%"]}, {"q": "Which of the following is a major threat to the Amazon Rainforest?", "type": "mcq", "answer": "A", "explain": "Climate change poses a significant threat to the Amazon Rainforest, affecting its ecosystems and biodiversity.", "options": ["Climate Change", "Overfishing", "Desertification", "Glacial Melting"]}, {"q": "What is the indigenous population of the Amazon Rainforest primarily known for?", "type": "mcq", "answer": "B", "explain": "The indigenous population of the Amazon is known for its rich cultural diversity and traditional knowledge of the rainforest.", "options": ["Agricultural practices", "Cultural diversity", "Technological advancements", "Urban development"]}]	{"source": {"type": "topic", "topic": "Amazon Forest"}, "language": "en", "difficulty": "mixed"}	private	\N	at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.exercise.post/3lxtndip2zm2f	bafyreidu3m54vrabi3dseifxtgpootdmo367pkyg3dbu6h3xaisgafo6ga	2025-09-02 13:26:18.753371+05:30	2025-09-02 13:26:22.146284+05:30	at://did:plc:matwoj635dvtorkqxgzw7sti/app.bsky.feed.post/3lxtndj6kui2u
a958386e-d588-438c-873a-76482c34d0ea	268a0026-45cd-41d8-9458-4c7874b22ba6	Untitled	mcq	[{"q": "Placeholder?", "type": "", "answer": ""}]	{"source": {"type": "topic", "topic": "demo"}, "language": "en", "difficulty": "easy"}	private	\N	at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.exercise.post/3lxtns6x2372d	bafyreicnzvssoq6nc3hdfljlhtbip5t6yph6gvxnid2o5raej25ot73ywq	2025-09-02 13:34:30.173838+05:30	2025-09-02 13:34:35.316375+05:30	at://did:plc:matwoj635dvtorkqxgzw7sti/app.bsky.feed.post/3lxtns7hje522
aa584217-35bd-49b4-a2fa-3a61404f9d23	268a0026-45cd-41d8-9458-4c7874b22ba6	Small Talk	mcq	[{"q": "What is a common topic for small talk?", "type": "mcq", "answer": "A", "explain": "The weather is a universally relatable topic that is often used in small talk.", "options": ["Weather", "Politics", "Economics", "Philosophy"]}, {"q": "Which of the following is NOT a good small talk topic?", "type": "mcq", "answer": "C", "explain": "Personal finances can be considered too private for casual conversation.", "options": ["Hobbies", "Travel", "Personal finances", "Movies"]}, {"q": "How should you respond to a compliment in small talk?", "type": "mcq", "answer": "C", "explain": "Accepting a compliment graciously helps to maintain a positive atmosphere.", "options": ["Ignore it", "Argue against it", "Accept it graciously", "Change the subject"]}, {"q": "What is a good way to keep a small talk conversation going?", "type": "mcq", "answer": "A", "explain": "Open-ended questions encourage the other person to share more, keeping the conversation flowing.", "options": ["Asking open-ended questions", "Giving one-word answers", "Talking about yourself only", "Interrupting frequently"]}, {"q": "Which phrase is commonly used to start a small talk conversation?", "type": "mcq", "answer": "A", "explain": "Asking 'How are you?' is a friendly and common way to initiate small talk.", "options": ["How are you?", "What do you think?", "Can I help you?", "What is your opinion?"]}]	{"source": {"type": "topic", "topic": "Small Talk"}, "language": "en", "difficulty": "mixed"}	private	\N	at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.exercise.post/3lxu453mekf2q	bafyreihfh464o42era7r3uzgvrcovvdjugcorsyaj2ybq7bwmr3vb5pr2a	2025-09-02 17:51:08.649808+05:30	2025-09-02 17:51:13.203018+05:30	at://did:plc:matwoj635dvtorkqxgzw7sti/app.bsky.feed.post/3lxu4543ly52u
f9abadde-0d63-48f3-b8a6-6ec95e91cbd5	29c27c16-89fa-4f73-941e-29c722ed7979	Moon	mcq	[{"q": "What is the primary reason the Moon appears to shine in the night sky?", "type": "mcq", "answer": "B", "explain": "The Moon shines because it reflects sunlight.", "options": ["It generates its own light", "It reflects sunlight", "It absorbs light", "It emits heat"]}, {"q": "Which of the following is the largest crater on the Moon?", "type": "mcq", "answer": "C", "explain": "Clavius is one of the largest craters on the Moon.", "options": ["Tycho", "Copernicus", "Clavius", "Mare Imbrium"]}, {"q": "How long does it take for the Moon to complete one orbit around the Earth?", "type": "mcq", "answer": "A", "explain": "The Moon takes approximately 27.3 days to orbit the Earth.", "options": ["27.3 days", "30 days", "29.5 days", "24 hours"]}, {"q": "What is the name of the dark, flat areas on the Moon's surface?", "type": "mcq", "answer": "B", "explain": "The dark areas on the Moon are called 'Maria', which are basaltic plains.", "options": ["Highlands", "Maria", "Craters", "Rilles"]}, {"q": "Which Apollo mission was the first to land humans on the Moon?", "type": "mcq", "answer": "B", "explain": "Apollo 11 was the first mission to successfully land humans on the Moon.", "options": ["Apollo 8", "Apollo 11", "Apollo 12", "Apollo 15"]}]	{"source": {"type": "topic", "topic": "Moon"}, "language": "en", "difficulty": "mixed"}	private	\N	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/com.inkreaders.exercise.post/3lxu6hclfgf2u	bafyreib6zamwbgwbreucl7ki6s34nxmv3njlwylvwpwdm7lcgjbcz5355m	2025-09-02 18:32:40.149856+05:30	2025-09-02 18:32:43.529024+05:30	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/app.bsky.feed.post/3lxu6hczaqv22
a45ea38f-8976-4e17-b766-c5d6ed726ba0	29c27c16-89fa-4f73-941e-29c722ed7979	Commutative Law	mcq	[{"q": "Which of the following expressions demonstrates the commutative law of addition?", "type": "mcq", "answer": "C", "explain": "The commutative law states that changing the order of the numbers does not change the sum.", "options": ["A) 3 + 5", "B) 5 + 3", "C) 3 + 5 = 5 + 3", "D) 3 - 5"]}, {"q": "Which operation is NOT commutative?", "type": "mcq", "answer": "C", "explain": "Subtraction is not commutative because a - b does not equal b - a.", "options": ["A) Addition", "B) Multiplication", "C) Subtraction", "D) Division"]}, {"q": "What is the result of applying the commutative law of multiplication to the numbers 4 and 7?", "type": "mcq", "answer": "D", "explain": "The commutative law states that a * b = b * a, so both expressions yield the same result.", "options": ["A) 28", "B) 7 * 4", "C) 4 * 7", "D) Both B and C"]}, {"q": "If a + b = c, which of the following is true according to the commutative law?", "type": "mcq", "answer": "A", "explain": "According to the commutative law, the order of addition can be switched without changing the result.", "options": ["A) b + a = c", "B) a - b = c", "C) c + a = b", "D) a + c = b"]}, {"q": "Which of the following pairs of numbers illustrates the commutative property of addition?", "type": "mcq", "answer": "D", "explain": "All pairs demonstrate the commutative property since the sum remains the same regardless of the order.", "options": ["A) (2, 3)", "B) (5, 5)", "C) (1, 4)", "D) All of the above"]}]	{"source": {"type": "topic", "topic": "Commutative Law"}, "language": "en", "difficulty": "mixed"}	private	\N	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/com.inkreaders.exercise.post/3lxucxua3kq2n	bafyreif6n3m36tharqkrevyeqdg6zwj5wczo6rjzw4ffste3doe5x6pvmm	2025-09-02 19:53:29.785855+05:30	2025-09-02 19:53:34.050503+05:30	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/app.bsky.feed.post/3lxucxuprgg2u
e320b4b2-b8cd-4262-a0fd-9c3a067a6817	29c27c16-89fa-4f73-941e-29c722ed7979	Associative Law	mcq	[{"q": "Which of the following expressions illustrates the Associative Law of addition?", "type": "mcq", "answer": "A", "explain": "The Associative Law states that the way in which numbers are grouped in addition does not change their sum.", "options": ["(2 + 3) + 4", "2 + (3 + 4)", "(2 + 3) + (4 + 5)", "2 + 3 + 4"]}, {"q": "Which operation does NOT follow the Associative Law?", "type": "mcq", "answer": "C", "explain": "Subtraction does not follow the Associative Law because changing the grouping can change the result.", "options": ["Addition", "Multiplication", "Subtraction", "Division"]}, {"q": "If a, b, and c are real numbers, which of the following is true according to the Associative Law of multiplication?", "type": "mcq", "answer": "A", "explain": "The Associative Law of multiplication states that the grouping of factors does not affect the product.", "options": ["a × (b × c) = (a × b) × c", "a × b × c = (b × c) × a", "(a × b) × c = a × b × c", "a × (b + c) = (a × b) + (a × c)"]}, {"q": "Which of the following is an example of the Associative Law in action?", "type": "mcq", "answer": "D", "explain": "All options demonstrate the Associative Law for addition and multiplication.", "options": ["(5 × 2) × 3 = 5 × (2 × 3)", "(4 + 6) + 2 = 4 + (6 + 2)", "5 + (3 + 2) = (5 + 3) + 2", "All of the above"]}, {"q": "What is the result of (1 + 2) + 3 using the Associative Law?", "type": "mcq", "answer": "B", "explain": "Using the Associative Law, (1 + 2) + 3 = 3 + 3 = 6, but the question asks for the sum of the first grouping.", "options": ["6", "5", "3", "4"]}]	{"source": {"type": "topic", "topic": "Associative Law"}, "language": "en", "difficulty": "mixed"}	private	\N	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/com.inkreaders.exercise.post/3lxudp2qx4d24	bafyreibda77w4q4zawjqglcu5jfwca46nvjzh3cwaqcord2ssfxdpy7f4u	2025-09-02 20:06:28.554757+05:30	2025-09-02 20:06:32.424356+05:30	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/app.bsky.feed.post/3lxudp36sit2x
634b152a-7759-4132-b8b1-02e284e1a546	29c27c16-89fa-4f73-941e-29c722ed7979	Full Moon	mcq	[{"id": "q1", "type": "mcq", "prompt": "What phase of the moon occurs when it is fully illuminated?", "options": ["New Moon", "First Quarter", "Full Moon", "Last Quarter"], "explanation": "The Full Moon phase occurs when the moon is fully illuminated by the sun.", "correct_answer": "C"}, {"id": "q2", "type": "mcq", "prompt": "How often does a Full Moon occur?", "options": ["Every week", "Every month", "Every year", "Every two weeks"], "explanation": "A Full Moon occurs approximately once a month, as it takes about 29.5 days for the moon to complete its cycle.", "correct_answer": "B"}, {"id": "q3", "type": "mcq", "prompt": "What is the term for the phenomenon when a Full Moon appears larger and brighter near the horizon?", "options": ["Lunar Eclipse", "Harvest Moon", "Supermoon", "Blue Moon"], "explanation": "A Supermoon occurs when the Full Moon coincides with its closest approach to Earth, making it appear larger and brighter.", "correct_answer": "C"}]	{"source": {"type": ""}, "language": "", "difficulty": ""}	private	\N	\N	\N	2025-09-06 16:29:19.234647+05:30	2025-09-06 16:29:19.234647+05:30	\N
20ab2745-603d-4a2b-b041-3d7115eff9e6	29c27c16-89fa-4f73-941e-29c722ed7979	What is calculus	mcq	[{"id": "q1", "type": "mcq", "prompt": "What is the derivative of sin(x)?", "options": ["cos(x)", "-cos(x)", "sin(x)", "tan(x)"], "explanation": "The derivative of sin(x) is cos(x).", "correct_answer": "A"}, {"id": "q2", "type": "mcq", "prompt": "What is the integral of 1/x dx?", "options": ["ln|x| + C", "x + C", "1/2 x^2 + C", "e^x + C"], "explanation": "The integral of 1/x is ln|x| + C.", "correct_answer": "A"}, {"id": "q3", "type": "mcq", "prompt": "What is the limit of (1/x) as x approaches 0?", "options": ["0", "∞", "-∞", "undefined"], "explanation": "As x approaches 0 from the positive side, 1/x approaches ∞.", "correct_answer": "B"}]	{"source": {"type": ""}, "language": "", "difficulty": ""}	private	\N	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/com.inkreaders.exercise.post/3lz3kjbm3tu2t	bafyreicqocw2krlvgxbtz4fuke7kcg26ij6yt7jp4dc6w6bgcsh6yal34m	2025-09-18 10:22:09.683652+05:30	2025-09-18 10:22:24.160308+05:30	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/app.bsky.feed.post/3lz3kjbwjj22l
d545e4b5-fb58-413e-a7d6-b0975ba317f5	29c27c16-89fa-4f73-941e-29c722ed7979	Distributive Law	mcq	[{"q": "Which of the following represents the Distributive Law?", "type": "mcq", "answer": "A", "explain": "The Distributive Law states that multiplying a number by a sum is the same as doing each multiplication separately.", "options": ["A) a(b + c) = ab + ac", "B) a + b = b + a", "C) a(bc) = (ab)c", "D) a - b = b - a"]}, {"q": "If a = 3, b = 4, and c = 5, what is the value of a(b + c) using the Distributive Law?", "type": "mcq", "answer": "A", "explain": "Using the Distributive Law: a(b + c) = 3(4 + 5) = 3 * 9 = 27.", "options": ["A) 24", "B) 15", "C) 21", "D) 12"]}, {"q": "Which expression is equivalent to 2(x + 3)?", "type": "mcq", "answer": "A", "explain": "Applying the Distributive Law: 2(x + 3) = 2x + 6.", "options": ["A) 2x + 6", "B) 2x + 3", "C) x + 6", "D) 2x + 9"]}, {"q": "What is the result of applying the Distributive Law to 5(2x - 3)?", "type": "mcq", "answer": "A", "explain": "Distributing 5 gives: 5(2x) - 5(3) = 10x - 15.", "options": ["A) 10x - 15", "B) 5x - 15", "C) 10x + 15", "D) 5x + 15"]}, {"q": "Which of the following is NOT an application of the Distributive Law?", "type": "mcq", "answer": "C", "explain": "x + y = y + x is an example of the Commutative Law, not the Distributive Law.", "options": ["A) 3(x + 4)", "B) 4(a - b)", "C) x + y = y + x", "D) 2(3 + 5)"]}]	{"source": {"type": "topic", "topic": "Distributive Law"}, "language": "en", "difficulty": "mixed"}	private	\N	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/com.inkreaders.exercise.post/3lxue6iqvhf2s	bafyreihzc6pa5ehj66ohtpdsmekyrdfs5mrowhyud4nhyhmjqrtgr2k43e	2025-09-02 20:15:06.833802+05:30	2025-09-02 20:15:10.417333+05:30	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/app.bsky.feed.post/3lxue6j6tqn2s
e66ae2d3-dc69-44ae-8646-bb58aec74c19	29c27c16-89fa-4f73-941e-29c722ed7979	Permutation	mcq	[{"q": "How many ways can 3 books be arranged on a shelf?", "type": "mcq", "answer": "B", "explain": "The number of arrangements of n items is n! (n factorial). For 3 books, it's 3! = 6.", "options": ["3", "6", "9", "12"]}, {"q": "In how many different ways can the letters of the word 'MATH' be arranged?", "type": "mcq", "answer": "B", "explain": "The word 'MATH' has 4 distinct letters, so the arrangements are 4! = 24.", "options": ["12", "24", "16", "20"]}, {"q": "If you have 5 different colored balls, how many ways can you select and arrange 2 of them?", "type": "mcq", "answer": "B", "explain": "The number of arrangements of 2 balls from 5 is P(5,2) = 5!/(5-2)! = 20.", "options": ["10", "20", "30", "50"]}, {"q": "What is the number of permutations of the letters in the word 'LEVEL'?", "type": "mcq", "answer": "C", "explain": "The word 'LEVEL' has 5 letters with 'E' repeating twice, so the permutations are 5!/2! = 60/2 = 30.", "options": ["60", "30", "20", "10"]}, {"q": "How many different ways can 4 students be seated in a row?", "type": "mcq", "answer": "C", "explain": "The number of arrangements of 4 students is 4! = 24.", "options": ["12", "16", "24", "48"]}]	{"source": {"type": "topic", "topic": "Permutation"}, "language": "en", "difficulty": "mixed"}	private	\N	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/com.inkreaders.exercise.post/3lxufjbup6d2x	bafyreia3pe7rtu6ucp5df3tiq3rklkxv7stbq3gf4njvaakxsq43fsxjza	2025-09-02 20:34:52.874646+05:30	2025-09-02 20:39:06.057835+05:30	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/app.bsky.feed.post/3lxufjccueq2n
debc8e34-5a3b-44c9-bc1d-30c378c66bf8	29c27c16-89fa-4f73-941e-29c722ed7979	Parking Management	mcq	[{"id": "q1", "type": "mcq", "prompt": "What is the primary purpose of parking management?", "options": ["To maximize revenue", "To minimize traffic congestion", "To enhance public safety", "All of the above"], "explanation": "Parking management aims to achieve multiple objectives including revenue maximization, traffic reduction, and safety enhancement.", "correct_answer": "D"}, {"id": "q2", "type": "mcq", "prompt": "Which of the following is a common method used in parking management?", "options": ["Dynamic pricing", "Flat rate pricing", "Free parking", "None of the above"], "explanation": "Dynamic pricing adjusts parking rates based on demand, making it a common and effective method in parking management.", "correct_answer": "A"}, {"id": "q3", "type": "mcq", "prompt": "What technology is often used to monitor parking space availability?", "options": ["CCTV cameras", "Parking meters", "Mobile apps", "All of the above"], "explanation": "Various technologies including CCTV, meters, and mobile apps are utilized to monitor and manage parking space availability.", "correct_answer": "D"}, {"id": "q4", "type": "mcq", "prompt": "Which of the following is NOT a benefit of effective parking management?", "options": ["Reduced emissions", "Increased traffic flow", "Higher parking fines", "Improved accessibility"], "explanation": "While effective parking management can lead to various benefits, higher parking fines are generally a consequence rather than a benefit.", "correct_answer": "C"}, {"id": "q5", "type": "mcq", "prompt": "What is a common challenge faced in urban parking management?", "options": ["Overcapacity", "Underutilization", "High costs", "All of the above"], "explanation": "Urban parking management often deals with multiple challenges including overcapacity, underutilization, and high operational costs.", "correct_answer": "D"}]	{"source": {"type": ""}, "language": "", "difficulty": ""}	private	\N	\N	\N	2025-09-08 15:51:46.744445+05:30	2025-09-08 15:51:46.744445+05:30	\N
0049910b-eebc-4aa8-97a5-dadc070ea827	29c27c16-89fa-4f73-941e-29c722ed7979	Lunar Eclipse	mcq	[{"q": "What causes a lunar eclipse?", "type": "mcq", "answer": "A", "explain": "A lunar eclipse occurs when the Earth is positioned directly between the Sun and the Moon.", "options": ["The Earth passes between the Sun and the Moon", "The Moon passes between the Earth and the Sun", "The Sun passes between the Earth and the Moon", "The Earth rotates on its axis"]}, {"q": "How many types of lunar eclipses are there?", "type": "mcq", "answer": "C", "explain": "There are three types of lunar eclipses: total, partial, and penumbral.", "options": ["One", "Two", "Three", "Four"]}, {"q": "During a total lunar eclipse, what color does the Moon typically appear?", "type": "mcq", "answer": "B", "explain": "The Moon often appears red during a total lunar eclipse due to Rayleigh scattering of sunlight through the Earth's atmosphere.", "options": ["Blue", "Red", "Green", "White"]}, {"q": "How often do lunar eclipses occur?", "type": "mcq", "answer": "B", "explain": "Lunar eclipses typically occur at least twice a year, depending on the alignment of the Earth, Moon, and Sun.", "options": ["Once a year", "Twice a year", "Every month", "Every five years"]}, {"q": "What is the term for the shadow cast by the Earth during a lunar eclipse?", "type": "mcq", "answer": "A", "explain": "The umbra is the darkest part of the shadow where the Earth completely blocks direct sunlight from reaching the Moon.", "options": ["Umbra", "Penumbra", "Antumbra", "Shadow"]}]	{"source": {"type": "topic", "topic": "Lunar Eclipse"}, "language": "en", "difficulty": "mixed"}	private	\N	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/com.inkreaders.exercise.post/3lxug62q5of2u	bafyreid4b3hk7brqncq5jqffxzdthsbhoqgnpk73gka4fwkrncwu5lynrq	2025-09-02 20:50:39.751402+05:30	2025-09-02 20:50:43.21227+05:30	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/app.bsky.feed.post/3lxug6367ri2u
5d98327a-fa49-4e17-b33e-c6b54a73ce71	29c27c16-89fa-4f73-941e-29c722ed7979	Birds	mcq	[{"q": "Which bird is known for its ability to mimic human speech?", "type": "mcq", "answer": "A", "explain": "Parrots are well-known for their vocal mimicry and ability to imitate human speech.", "options": ["A. Parrot", "B. Sparrow", "C. Eagle", "D. Penguin"]}, {"q": "What is the largest species of bird in the world?", "type": "mcq", "answer": "A", "explain": "The ostrich is the largest bird species, capable of reaching heights of up to 9 feet.", "options": ["A. Ostrich", "B. Albatross", "C. Eagle", "D. Emu"]}, {"q": "Which bird is famous for its colorful plumage and courtship dances?", "type": "mcq", "answer": "A", "explain": "Peacocks are renowned for their vibrant feathers and elaborate courtship displays.", "options": ["A. Peacock", "B. Robin", "C. Crow", "D. Finch"]}, {"q": "What type of bird is known for building intricate nests?", "type": "mcq", "answer": "A", "explain": "Weaver birds are known for their complex and beautifully woven nests.", "options": ["A. Weaver bird", "B. Pigeon", "C. Falcon", "D. Hummingbird"]}, {"q": "Which bird is a symbol of peace?", "type": "mcq", "answer": "A", "explain": "Doves are widely recognized as symbols of peace and harmony.", "options": ["A. Dove", "B. Hawk", "C. Vulture", "D. Owl"]}]	{"source": {"type": "topic", "topic": "Birds"}, "language": "en", "difficulty": "mixed"}	private	\N	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/com.inkreaders.exercise.post/3lxumneuiww2g	bafyreiboz7f4ljm7bun6e2nsnh5azrbgix4mih2pqjettqybvopxghowhy	2025-09-02 22:45:52.151763+05:30	2025-09-02 22:46:39.682384+05:30	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/app.bsky.feed.post/3lxumnfdsd424
9ce7ed25-71ae-439c-bfcc-9d61dc560b9b	29c27c16-89fa-4f73-941e-29c722ed7979	Indian Rivers	mcq	[{"q": "Which river is known as the 'Ganga of the South'?", "type": "mcq", "answer": "A", "explain": "The Godavari River is often referred to as the 'Ganga of the South' due to its significance and size.", "options": ["Godavari", "Krishna", "Kaveri", "Narmada"]}, {"q": "Which river flows through the city of Varanasi?", "type": "mcq", "answer": "B", "explain": "The Ganges River flows through Varanasi, which is one of the holiest cities in India.", "options": ["Yamuna", "Ganges", "Saraswati", "Brahmaputra"]}, {"q": "What is the longest river in India?", "type": "mcq", "answer": "C", "explain": "The Indus River is the longest river in India, flowing for about 3,180 kilometers.", "options": ["Ganges", "Brahmaputra", "Indus", "Godavari"]}, {"q": "Which river is considered the lifeline of Rajasthan?", "type": "mcq", "answer": "C", "explain": "The Luni River is often referred to as the lifeline of Rajasthan due to its importance in the region.", "options": ["Saraswati", "Brahmaputra", "Luni", "Sabarmati"]}, {"q": "Which river is known for its delta formed in the Sundarbans?", "type": "mcq", "answer": "A", "explain": "The Ganges River forms a large delta in the Sundarbans, which is a UNESCO World Heritage Site.", "options": ["Ganges", "Brahmaputra", "Mahanadi", "Godavari"]}]	{"source": {"type": "topic", "topic": "Indian Rivers"}, "language": "en", "difficulty": "mixed"}	private	\N	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/com.inkreaders.exercise.post/3lxunbwev562u	bafyreiaz7yaxnrzalas5yct5dpmsn5my6mrt63wnb2lf6rws6bay7ks7i4	2025-09-02 22:58:03.771691+05:30	2025-09-02 22:58:09.046656+05:30	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/app.bsky.feed.post/3lxunbwsrj22d
23fb2008-16d2-4497-aea7-0b0882b1f471	29c27c16-89fa-4f73-941e-29c722ed7979	Indian Games	mcq	[{"q": "Which traditional Indian game is played on a board with 14 pits?", "type": "mcq", "answer": "C", "explain": "Pachisi is known as the national game of India and is played on a cross-shaped board with 14 pits.", "options": ["A. Ludo", "B. Carrom", "C. Pachisi", "D. Snakes and Ladders"]}, {"q": "What is the primary objective of the game Kabaddi?", "type": "mcq", "answer": "B", "explain": "In Kabaddi, the main objective is to tag opponents while holding one's breath and returning to the starting point.", "options": ["A. To score goals", "B. To tag opponents", "C. To collect coins", "D. To build structures"]}, {"q": "Which Indian game involves players trying to hit a wooden disc into a hole?", "type": "mcq", "answer": "B", "explain": "Carrom is a popular indoor game in India where players use a striker to hit wooden discs into corner pockets.", "options": ["A. Gully Cricket", "B. Carrom", "C. Kho Kho", "D. Chess"]}, {"q": "In which game do players form two teams and try to catch a player from the opposing team?", "type": "mcq", "answer": "A", "explain": "Kabaddi is played between two teams where one team sends a raider to tag opponents while the other team tries to catch them.", "options": ["A. Kabaddi", "B. Gully Cricket", "C. Badminton", "D. Chess"]}, {"q": "Which game is often referred to as the 'game of kings' in India?", "type": "mcq", "answer": "B", "explain": "Chess is known as the 'game of kings' and has deep historical roots in Indian culture.", "options": ["A. Ludo", "B. Chess", "C. Snakes and Ladders", "D. Carrom"]}]	{"source": {"type": "topic", "topic": "Indian Games"}, "language": "en", "difficulty": "mixed"}	private	\N			2025-09-03 12:58:40.816214+05:30	2025-09-03 12:58:40.816214+05:30	\N
cb5efd64-fd0a-4f30-bef0-c68da0b8ee19	29c27c16-89fa-4f73-941e-29c722ed7979	Ramayana	mcq	[{"q": "Who is the author of the Ramayana?", "type": "mcq", "answer": "A", "explain": "Valmiki is traditionally regarded as the author of the Ramayana.", "options": ["Valmiki", "Vyasa", "Tulsidas", "Kalidasa"]}, {"q": "Which character is known for his unwavering devotion to Lord Rama?", "type": "mcq", "answer": "B", "explain": "Hanuman is celebrated for his devotion and loyalty to Lord Rama.", "options": ["Lakshmana", "Hanuman", "Ravana", "Bharata"]}, {"q": "What is the name of Rama's wife?", "type": "mcq", "answer": "A", "explain": "Sita is the wife of Lord Rama in the Ramayana.", "options": ["Sita", "Tara", "Mandodari", "Kaikeyi"]}, {"q": "Who abducted Sita in the Ramayana?", "type": "mcq", "answer": "B", "explain": "Ravana, the king of Lanka, abducted Sita.", "options": ["Vibhishana", "Ravana", "Kumbhakarna", "Indrajit"]}, {"q": "What is the significance of the Ramayana in Hindu culture?", "type": "mcq", "answer": "C", "explain": "The Ramayana is an epic poem that narrates the life and adventures of Lord Rama.", "options": ["It is a historical account", "It is a philosophical text", "It is an epic poem", "It is a collection of hymns"]}]	{"source": {"type": "topic", "topic": "Ramayana"}, "language": "en", "difficulty": "mixed"}	private	\N			2025-09-03 13:16:30.079376+05:30	2025-09-03 13:16:30.079376+05:30	\N
1585f6a1-f65a-472e-b5a8-c599bb01cf6c	29c27c16-89fa-4f73-941e-29c722ed7979	Mahabharatha	mcq	[{"q": "Who is considered the main protagonist of the Mahabharata?", "type": "mcq", "answer": "Arjuna", "explain": "Arjuna is one of the central characters and a key warrior in the Mahabharata.", "options": ["Yudhishthira", "Arjuna", "Bhima", "Krishna"]}, {"q": "What is the name of the epic's great war?", "type": "mcq", "answer": "Kurukshetra War", "explain": "The Kurukshetra War is the central event of the Mahabharata, where the Pandavas and Kauravas battle.", "options": ["Kurukshetra War", "Mahabharata War", "Dharma Yudhha", "Battle of the Gods"]}]	{"source": {"type": "topic", "topic": "Mahabharatha"}, "language": "en", "difficulty": "mixed"}	private	\N	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/com.inkreaders.exercise.post/3lxw66yckol2u	bafyreicumzbyz6ibcstfdnfakbi56ickdfnrt33u4zpfg7d7dg67fdlkzy	2025-09-03 13:32:52.995122+05:30	2025-09-03 13:33:23.809673+05:30	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/app.bsky.feed.post/3lxw66yrnvr26
70086c24-f683-4a78-b287-468627d85395	29c27c16-89fa-4f73-941e-29c722ed7979	Gita	mcq	[]	{"source": {"type": "topic", "topic": "Gita"}, "language": "en", "difficulty": "mixed"}	private	\N			2025-09-03 13:39:05.391927+05:30	2025-09-03 13:39:05.391927+05:30	\N
67e1b014-34d8-4a55-b7a3-60e4f96b7a4f	29c27c16-89fa-4f73-941e-29c722ed7979	Gita	mcq	[]	{"source": {"type": "topic", "topic": "Gita"}, "language": "en", "difficulty": "mixed"}	private	\N			2025-09-03 13:39:55.322542+05:30	2025-09-03 13:39:55.322542+05:30	\N
0b235984-5db0-4aa4-8074-09b0de267c25	29c27c16-89fa-4f73-941e-29c722ed7979	Glue	true_false	[{"q": "", "type": "true_false", "answer": null}, {"q": "", "type": "true_false", "answer": null}]	{"source": {"type": ""}, "language": "", "difficulty": ""}	private	\N			2025-09-03 15:52:14.584085+05:30	2025-09-03 15:52:14.584085+05:30	\N
8e7b8c7f-7702-4e60-9edb-5ebfe9e06b8f	29c27c16-89fa-4f73-941e-29c722ed7979	Yamuna	true_false	[{"q": "", "type": "true_false", "answer": null}, {"q": "", "type": "true_false", "answer": null}]	{"source": {"type": ""}, "language": "", "difficulty": ""}	private	\N			2025-09-03 15:56:24.207158+05:30	2025-09-03 15:56:24.207158+05:30	\N
96ed5dd5-ff20-4420-bcdf-86de8d479894	29c27c16-89fa-4f73-941e-29c722ed7979	Cleaning	true_false	[{"q": "", "type": "true_false", "answer": null}, {"q": "", "type": "true_false", "answer": null}]	{"source": {"type": ""}, "language": "", "difficulty": ""}	private	\N			2025-09-03 16:09:11.436089+05:30	2025-09-03 16:09:11.436089+05:30	\N
bdd1669a-2c84-46d3-9319-649853087018	29c27c16-89fa-4f73-941e-29c722ed7979	Exercise	true_false	[{"q": "", "type": "true_false", "answer": null}, {"q": "", "type": "true_false", "answer": null}]	{"source": {"type": ""}, "language": "", "difficulty": ""}	private	\N			2025-09-03 16:14:38.216192+05:30	2025-09-03 16:14:38.216192+05:30	\N
b10f0879-1070-40ce-9f35-1d4960f34d0f	29c27c16-89fa-4f73-941e-29c722ed7979	Indian Banyan Tree	mcq	[{"id": "q1", "type": "mcq", "prompt": "What is the scientific name of the Indian Banyan Tree?", "options": ["Ficus carica", "Ficus elastica", "Ficus benghalensis", "Ficus lyrata"], "explanation": "The scientific name of the Indian Banyan Tree is Ficus benghalensis.", "correct_answer": null}, {"id": "q2", "type": "mcq", "prompt": "Which part of the Indian Banyan Tree is known for its aerial roots?", "options": ["Leaves", "Branches", "Trunk", "Flowers"], "explanation": "The branches of the Indian Banyan Tree produce aerial roots that grow downwards.", "correct_answer": null}, {"id": "q3", "type": "mcq", "prompt": "What is a notable feature of the Indian Banyan Tree?", "options": ["It can live for over a thousand years", "It has no leaves", "It grows only in deserts", "It produces no fruit"], "explanation": "The Indian Banyan Tree is known for its longevity, often living for over a thousand years.", "correct_answer": null}, {"id": "q4", "type": "mcq", "prompt": "In which Indian state is the largest Banyan Tree located?", "options": ["Maharashtra", "West Bengal", "Karnataka", "Uttar Pradesh"], "explanation": "The largest Banyan Tree, known as the Great Banyan Tree, is located in West Bengal.", "correct_answer": null}, {"id": "q5", "type": "mcq", "prompt": "What is the primary ecological role of the Indian Banyan Tree?", "options": ["Providing shade", "Serving as a habitat for birds", "Producing oxygen", "All of the above"], "explanation": "The Indian Banyan Tree provides shade, serves as a habitat for various birds, and contributes to oxygen production.", "correct_answer": null}]	{"source": {"type": ""}, "language": "", "difficulty": ""}	private	\N	\N	\N	2025-09-04 12:28:00.638626+05:30	2025-09-04 12:28:00.638626+05:30	\N
6f70be62-f3eb-4625-8d38-a5aecbad6e82	29c27c16-89fa-4f73-941e-29c722ed7979	Geo Politics	fill_blank	[{"id": "q1", "type": "fill_blank", "prompt": "The __________ is a geopolitical region that includes countries like Russia, China, and India, often referred to as the BRICS nations.", "explanation": "BRICS stands for Brazil, Russia, India, China, and South Africa, which are emerging economies.", "correct_answer": null}, {"id": "q2", "type": "fill_blank", "prompt": "The concept of __________ refers to the influence of geography on international politics and relations.", "explanation": "Geopolitics examines how geographic factors affect political power and international relations.", "correct_answer": null}]	{"source": {"type": ""}, "language": "", "difficulty": ""}	private	\N	\N	\N	2025-09-04 19:13:49.049787+05:30	2025-09-04 19:13:49.049787+05:30	\N
812a1fbb-a2d2-4d74-aeeb-3e79f8a023f6	29c27c16-89fa-4f73-941e-29c722ed7979	Eye Colors	mcq	[{"id": "q1", "type": "mcq", "prompt": "What is the most common eye color in the world?", "options": ["Blue", "Brown", "Green", "Hazel"], "explanation": "Brown is the most common eye color globally, with a majority of the world's population having brown eyes.", "correct_answer": null}, {"id": "q2", "type": "mcq", "prompt": "Which eye color is often associated with a higher sensitivity to light?", "options": ["Blue", "Brown", "Green", "Gray"], "explanation": "People with blue eyes tend to have less pigment in their irises, which can lead to increased sensitivity to bright light.", "correct_answer": null}]	{"source": {"type": ""}, "language": "", "difficulty": ""}	private	\N	\N	\N	2025-09-04 19:58:09.635964+05:30	2025-09-04 19:58:09.635964+05:30	\N
ffaa69fc-59d7-4aba-b96e-002917e783de	29c27c16-89fa-4f73-941e-29c722ed7979	Statistical Computations	mcq	[{"id": "q1", "type": "mcq", "prompt": "What is the mean of the following set of numbers: 4, 8, 6, 5, 3?", "options": ["4", "5", "6", "7"], "explanation": "The mean is calculated by adding all numbers and dividing by the count: (4+8+6+5+3)/5 = 26/5 = 5.2.", "correct_answer": "6"}, {"id": "q2", "type": "mcq", "prompt": "Which measure of central tendency is most affected by extreme values?", "options": ["Mean", "Median", "Mode", "Range"], "explanation": "The mean is sensitive to extreme values, while the median and mode are not.", "correct_answer": "Mean"}]	{"source": {"type": ""}, "language": "", "difficulty": ""}	private	\N	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/com.inkreaders.exercise.post/3lxzkesbehs2d	bafyreigfoc6ohddtudzrk7eg2wadlesrm4xhez37g2goia5pxu5vvzz52i	2025-09-04 20:50:20.247074+05:30	2025-09-04 21:49:22.953672+05:30	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/app.bsky.feed.post/3lxzkesrrsv2d
6104fca6-657b-4cb1-b71e-23216e58d4a0	29c27c16-89fa-4f73-941e-29c722ed7979	Binomial Distribution	fill_blank	[{"id": "q1", "type": "fill_blank", "prompt": "In a binomial distribution, the probability of success is denoted by _____.", "explanation": "In binomial distribution, 'p' represents the probability of success in a single trial.", "correct_answer": "p"}, {"id": "q2", "type": "fill_blank", "prompt": "The number of trials in a binomial distribution is represented by the variable _____.", "explanation": "In binomial distribution, 'n' indicates the total number of independent trials.", "correct_answer": "n"}]	{"source": {"type": ""}, "language": "", "difficulty": ""}	private	\N	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/com.inkreaders.exercise.post/3lxzgonqdtt2g	bafyreiezj6jumz3xykm6fff5ym5rdrsj2i6v3eleb6ekj6po3dblnyqoou	2025-09-04 20:29:34.480538+05:30	2025-09-04 20:43:18.689205+05:30	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/app.bsky.feed.post/3lxzgoo63ag2l
d01a9c44-0d26-4ed0-8dfd-afb3df528191	29c27c16-89fa-4f73-941e-29c722ed7979	Probability Mass Function	mcq	[{"id": "q1", "type": "mcq", "prompt": "What does a Probability Mass Function (PMF) describe?", "options": ["The probability of continuous outcomes", "The probability of discrete outcomes", "The expected value of a random variable", "The variance of a random variable"], "explanation": "A PMF is used to describe the probability distribution of a discrete random variable.", "correct_answer": "B"}, {"id": "q2", "type": "mcq", "prompt": "If a discrete random variable X has a PMF given by P(X=x) = kx for x = 1, 2, 3, what is the value of k if the total probability must equal 1?", "options": ["1/6", "1/3", "1/2", "1"], "explanation": "To find k, we set up the equation k(1 + 2 + 3) = 1, leading to k = 1/6.", "correct_answer": "A"}]	{"source": {"type": ""}, "language": "", "difficulty": ""}	private	\N	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/com.inkreaders.exercise.post/3ly2fyqfz752t	bafyreielcxalo5jalwmbwiacdolze52spmnprejznxkqixm37ctky4yf4y	2025-09-05 06:03:19.86823+05:30	2025-09-05 06:03:43.033882+05:30	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/app.bsky.feed.post/3ly2fyquaci2d
b1b4d2bf-5a58-4999-95e4-65058acd4791	29c27c16-89fa-4f73-941e-29c722ed7979	Density Function	mcq	[{"id": "q1", "type": "mcq", "prompt": "What is the integral of a probability density function over its entire range?", "options": ["0", "1", "Depends on the function", "Infinity"], "explanation": "The integral of a probability density function over its entire range must equal 1, representing the total probability.", "correct_answer": "1"}, {"id": "q2", "type": "mcq", "prompt": "Which of the following is a property of a probability density function?", "options": ["It can take negative values", "The area under the curve is always less than 1", "It is non-negative for all values", "It must be a linear function"], "explanation": "A probability density function must be non-negative for all values to represent valid probabilities.", "correct_answer": "It is non-negative for all values"}]	{"source": {"type": ""}, "language": "", "difficulty": ""}	private	\N	\N	\N	2025-09-06 09:57:41.595157+05:30	2025-09-06 09:57:41.595157+05:30	\N
9d0b7e35-0997-4f13-9556-fc731b4c4c51	29c27c16-89fa-4f73-941e-29c722ed7979	De Morgans Law	mcq	[{"id": "q1", "type": "mcq", "prompt": "Which of the following represents De Morgan's Law for negation of a conjunction?", "options": ["¬(A ∧ B) = ¬A ∨ ¬B", "¬(A ∨ B) = ¬A ∧ ¬B", "A ∧ B = ¬(¬A ∨ ¬B)", "A ∨ B = ¬(¬A ∧ ¬B)"], "explanation": "De Morgan's Law states that the negation of a conjunction is equivalent to the disjunction of the negations.", "correct_answer": "A"}, {"id": "q2", "type": "mcq", "prompt": "What is the result of applying De Morgan's Law to the expression ¬(P ∨ Q)?", "options": ["¬P ∧ ¬Q", "¬P ∨ ¬Q", "P ∧ Q", "P ∨ Q"], "explanation": "According to De Morgan's Law, the negation of a disjunction is equivalent to the conjunction of the negations.", "correct_answer": "A"}, {"id": "q3", "type": "mcq", "prompt": "Which of the following statements is true regarding De Morgan's Laws?", "options": ["They apply only to logical conjunctions.", "They apply only to logical disjunctions.", "They apply to both conjunctions and disjunctions.", "They are not applicable in Boolean algebra."], "explanation": "De Morgan's Laws apply to both conjunctions and disjunctions in logical expressions.", "correct_answer": "C"}]	{"source": {"type": ""}, "language": "", "difficulty": ""}	private	\N	\N	\N	2025-09-08 19:00:04.336454+05:30	2025-09-08 19:00:04.336454+05:30	\N
290f7399-3085-443f-b51b-9256e48770a6	29c27c16-89fa-4f73-941e-29c722ed7979	Algebra polynomials	mcq	[{"id": "q1", "type": "mcq", "prompt": "What is the degree of the polynomial 4x^3 - 2x^2 + x - 5?", "options": ["1", "2", "3", "4"], "explanation": "The degree of a polynomial is the highest power of the variable, which is 3 in this case.", "correct_answer": "3"}, {"id": "q2", "type": "mcq", "prompt": "Which of the following is a factor of the polynomial x^2 - 5x + 6?", "options": ["x - 2", "x + 3", "x - 3", "x + 2"], "explanation": "The polynomial can be factored as (x - 2)(x - 3), making x - 2 a factor.", "correct_answer": "x - 2"}, {"id": "q3", "type": "mcq", "prompt": "What is the result of adding the polynomials (2x^2 + 3x) and (4x^2 - x)?", "options": ["6x^2 + 2x", "2x^2 + 4x", "6x^2 + 4x", "2x^2 + 2x"], "explanation": "Combining like terms gives 2x^2 + 4x^2 + 3x - x = 6x^2 + 2x.", "correct_answer": "6x^2 + 2x"}]	{"source": {"type": ""}, "language": "", "difficulty": ""}	private	\N	\N	\N	2025-09-09 07:06:12.802044+05:30	2025-09-09 07:06:12.802044+05:30	\N
3d89be9b-57ed-41ef-be19-ae58ce9fd7bd	29c27c16-89fa-4f73-941e-29c722ed7979	Probability Debsity Function	mcq	[{"id": "q1", "type": "mcq", "prompt": "What is the integral of a probability density function (PDF) over its entire range?", "options": ["0", "1", "Depends on the function", "Infinity"], "explanation": "The integral of a PDF over its entire range must equal 1, representing total probability.", "correct_answer": "1"}, {"id": "q2", "type": "mcq", "prompt": "Which of the following is a characteristic of a probability density function?", "options": ["It can take negative values", "It is always continuous", "The area under the curve is less than 1", "It must be non-negative"], "explanation": "A PDF cannot take negative values, as probabilities cannot be negative.", "correct_answer": "It must be non-negative"}, {"id": "q3", "type": "mcq", "prompt": "If a random variable X has a uniform distribution between 0 and 1, what is the PDF of X?", "options": ["0 for x < 0 or x > 1, 1 for 0 ≤ x ≤ 1", "x for 0 ≤ x ≤ 1", "1 for x < 0 or x > 1, 0 for 0 ≤ x ≤ 1", "x^2 for 0 ≤ x ≤ 1"], "explanation": "The uniform distribution has a constant PDF of 1 over the interval [0, 1].", "correct_answer": "0 for x < 0 or x > 1, 1 for 0 ≤ x ≤ 1"}, {"id": "q4", "type": "mcq", "prompt": "In a normal distribution, what shape does the probability density function take?", "options": ["Uniform", "Exponential", "Bell-shaped", "Linear"], "explanation": "The PDF of a normal distribution is bell-shaped, centered around the mean.", "correct_answer": "Bell-shaped"}, {"id": "q5", "type": "mcq", "prompt": "What does the area under the curve of a probability density function represent?", "options": ["The mean of the distribution", "The variance of the distribution", "The probability of a specific outcome", "The probability of falling within a certain range"], "explanation": "The area under the curve between two points represents the probability of the random variable falling within that range.", "correct_answer": "The probability of falling within a certain range"}]	{"source": {"type": ""}, "language": "", "difficulty": ""}	private	\N	\N	\N	2025-09-10 16:21:08.547321+05:30	2025-09-10 16:21:08.547321+05:30	\N
08ac192b-6b8c-43a5-ab4d-6f7ca244a516	29c27c16-89fa-4f73-941e-29c722ed7979	Conditional Probability	mcq	[{"id": "q1", "type": "mcq", "prompt": "If P(A) = 0.5 and P(B|A) = 0.4, what is P(A and B)?", "options": ["0.2", "0.4", "0.5", "0.1"], "explanation": "P(A and B) = P(A) * P(B|A) = 0.5 * 0.4 = 0.2.", "correct_answer": "0.2"}, {"id": "q2", "type": "mcq", "prompt": "What is the formula for conditional probability?", "options": ["P(A|B) = P(A and B) / P(B)", "P(A|B) = P(B) / P(A)", "P(A|B) = P(A) + P(B)", "P(A|B) = P(A) * P(B)"], "explanation": "The formula for conditional probability is P(A|B) = P(A and B) / P(B).", "correct_answer": "P(A|B) = P(A and B) / P(B)"}, {"id": "q3", "type": "mcq", "prompt": "If two events A and B are independent, what is P(A|B)?", "options": ["P(A)", "P(B)", "P(A and B)", "0"], "explanation": "If A and B are independent, then P(A|B) = P(A).", "correct_answer": "P(A)"}, {"id": "q4", "type": "mcq", "prompt": "If P(B) = 0.3 and P(A|B) = 0.6, what is P(A and B)?", "options": ["0.18", "0.12", "0.3", "0.6"], "explanation": "P(A and B) = P(B) * P(A|B) = 0.3 * 0.6 = 0.18.", "correct_answer": "0.18"}, {"id": "q5", "type": "mcq", "prompt": "In a survey, 70% of people like coffee and 50% of coffee drinkers like tea. What is the probability that a randomly selected person likes tea given that they like coffee?", "options": ["0.5", "0.7", "0.35", "0.3"], "explanation": "P(Tea|Coffee) = P(Tea and Coffee) / P(Coffee) = 0.5.", "correct_answer": "0.5"}]	{"source": {"type": ""}, "language": "", "difficulty": ""}	private	\N	\N	\N	2025-09-11 17:21:39.552333+05:30	2025-09-11 17:21:39.552333+05:30	\N
9512d3b3-5cfb-4863-911e-c751152c8778	268a0026-45cd-41d8-9458-4c7874b22ba6	Quantom Physica	mcq	[{"id": "q1", "type": "mcq", "prompt": "What is the principle that states that certain pairs of physical properties cannot be simultaneously known to arbitrary precision?", "options": ["Heisenberg Uncertainty Principle", "Pauli Exclusion Principle", "Quantum Superposition", "Wave-Particle Duality"], "explanation": "The Heisenberg Uncertainty Principle asserts that the position and momentum of a particle cannot both be precisely determined at the same time.", "correct_answer": "A"}, {"id": "q2", "type": "mcq", "prompt": "Which phenomenon describes the ability of particles to exist in multiple states at once until measured?", "options": ["Quantum Entanglement", "Quantum Tunneling", "Quantum Superposition", "Wave-Particle Duality"], "explanation": "Quantum Superposition refers to a particle's ability to be in multiple states simultaneously until an observation is made.", "correct_answer": "C"}, {"id": "q3", "type": "mcq", "prompt": "What is the term for the entangled state where two particles become linked and the state of one instantly influences the state of the other, regardless of distance?", "options": ["Quantum Tunneling", "Quantum Entanglement", "Quantum Decoherence", "Quantum Superposition"], "explanation": "Quantum Entanglement describes a phenomenon where particles become interconnected, such that the state of one particle can instantaneously affect the state of another, no matter the distance.", "correct_answer": "B"}, {"id": "q4", "type": "mcq", "prompt": "Which of the following is a fundamental concept in quantum mechanics that describes the dual nature of matter and light?", "options": ["Wave-Particle Duality", "Quantum Superposition", "Quantum Entanglement", "Heisenberg Uncertainty Principle"], "explanation": "Wave-Particle Duality is the concept that every particle or quantum entity may be described as either a particle or a wave.", "correct_answer": "A"}, {"id": "q5", "type": "mcq", "prompt": "What is the name of the theoretical particle that mediates the force of gravity in quantum field theory?", "options": ["Photon", "Gluon", "Graviton", "W/Z Boson"], "explanation": "The Graviton is the hypothetical elementary particle that mediates the force of gravitation in quantum field theory.", "correct_answer": "C"}]	{"source": {"type": ""}, "language": "", "difficulty": ""}	private	\N	\N	\N	2025-09-15 17:18:03.407934+05:30	2025-09-15 17:18:03.407934+05:30	\N
d1df1fe6-d02d-4b29-a9ae-c46ac8c8f0bb	29c27c16-89fa-4f73-941e-29c722ed7979	MCP	mcq	[{"id": "q1", "type": "mcq", "prompt": "What does MCP stand for in the context of computing?", "options": ["Micro Control Processor", "Multi-Core Processor", "Memory Control Protocol", "Main Control Program"], "explanation": "MCP commonly refers to Multi-Core Processor, which utilizes multiple processing units.", "correct_answer": "B"}, {"id": "q2", "type": "mcq", "prompt": "Which of the following is a primary function of an MCP?", "options": ["Data storage", "Task scheduling", "Network management", "User interface design"], "explanation": "Task scheduling is a key function of a Multi-Core Processor to manage workloads efficiently.", "correct_answer": "B"}, {"id": "q3", "type": "mcq", "prompt": "In which scenario would an MCP be most beneficial?", "options": ["Single-threaded applications", "High-performance computing", "Basic data entry tasks", "Web browsing"], "explanation": "MCPs excel in high-performance computing where parallel processing can significantly enhance performance.", "correct_answer": "B"}, {"id": "q4", "type": "mcq", "prompt": "What is a potential drawback of using MCPs?", "options": ["Increased power consumption", "Limited processing power", "Higher cost", "All of the above"], "explanation": "MCPs can lead to increased power consumption, higher costs, and may not always provide a linear increase in processing power.", "correct_answer": "D"}, {"id": "q5", "type": "mcq", "prompt": "Which of the following is NOT a characteristic of MCPs?", "options": ["Parallel processing", "Increased heat generation", "Single-core architecture", "Improved multitasking capabilities"], "explanation": "MCPs are characterized by their multi-core architecture, which allows for parallel processing.", "correct_answer": "C"}]	{"source": {"type": ""}, "language": "", "difficulty": ""}	private	\N	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/com.inkreaders.exercise.post/3lz6ve5bzfl2v	bafyreiaz3npl27ho3sscd7c37tfqflc3fsn5akpdir7tioysk3ry4ow4d4	2025-09-19 18:13:58.538478+05:30	2025-09-19 18:14:22.165946+05:30	at://did:plc:km2nrwo7d6p3x3j5z5mmg6jl/app.bsky.feed.post/3lz6ve5leqw2k
\.


--
-- Data for Name: exercises; Type: TABLE DATA; Schema: public; Owner: ink
--

COPY public.exercises (id, user_id, topic_id, response_id, title, format, questions, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: files; Type: TABLE DATA; Schema: public; Owner: ink
--

COPY public.files (id, user_id, mime, storage_key, pages, chars, created_at) FROM stdin;
\.


--
-- Data for Name: follows; Type: TABLE DATA; Schema: public; Owner: ink
--

COPY public.follows (src_did, dst_did, created_at) FROM stdin;
\.


--
-- Data for Name: highlights; Type: TABLE DATA; Schema: public; Owner: ink
--

COPY public.highlights (id, topic_id, response_id, user_id, excerpt, color, note, created_at, updated_at) FROM stdin;
970d7732-8aef-4c15-b6d1-1a1ba7ec3491	0c6158e8-972b-4f7a-be85-a0711ce0232a	35a68686-6a53-4006-bd4e-925d9af29559	29c27c16-89fa-4f73-941e-29c722ed7979	If you take multiple samples of size 30 from a population and calculate the mean for each sample, the distribution of those sample means will form a sampling distribution.	yellow	This is what it is 	2025-09-21 12:37:44.597635+05:30	2025-09-21 12:38:04.038823+05:30
8c4a35ec-f4ea-425e-a7ae-de4db1759459	8209ee91-860e-4415-97b4-91f6f1e3b60d	39ff51ad-da1b-4efd-b159-ce1839947eed	29c27c16-89fa-4f73-941e-29c722ed7979	Example:\nIf you roll a six-sided die, the probability of rolling a 4 is:\n\nFavorable outcomes: 1 (only the number 4)\nTotal outcomes: 6 (1, 2, 3, 4, 5, 6)	green	Hello	2025-09-21 12:39:55.529903+05:30	2025-09-21 12:53:45.455122+05:30
e94a122f-2b6f-488e-bab5-3efdecc5fb5c	8209ee91-860e-4415-97b4-91f6f1e3b60d	39ff51ad-da1b-4efd-b159-ce1839947eed	29c27c16-89fa-4f73-941e-29c722ed7979	If you roll a six-sided die, the probability of rolling a 4 is:\n\nFavorable outcomes: 1 (only the number 4)\nTotal outcomes: 6 (1, 2, 3, 4, 5, 6)	yellow	Add a note	2025-09-21 12:53:58.165926+05:30	2025-09-21 12:57:21.171314+05:30
2db84af5-4441-4efd-9cab-7c816cf67275	0c6158e8-972b-4f7a-be85-a0711ce0232a	35a68686-6a53-4006-bd4e-925d9af29559	29c27c16-89fa-4f73-941e-29c722ed7979	If you take multiple samples of size 30 from a population and calculate the mean for each sample, the distribution of those sample means will form a sampling distribution.	green	ColorChange	2025-09-21 13:05:05.675076+05:30	2025-09-21 13:05:36.743196+05:30
93e6b7f0-7d30-4bd1-bd95-58aec3f79e65	8209ee91-860e-4415-97b4-91f6f1e3b60d	39ff51ad-da1b-4efd-b159-ce1839947eed	29c27c16-89fa-4f73-941e-29c722ed7979	Range: Probability values range from 0 to 1. A probability of 0 means the event cannot happen, while a probability of 1 means the event will definitely happen.	yellow	Sampling	2025-09-21 13:08:28.561243+05:30	2025-09-21 13:08:28.561243+05:30
d4ce1afb-66fe-4c24-81dd-82cd3c63536a	0c6158e8-972b-4f7a-be85-a0711ce0232a	35a68686-6a53-4006-bd4e-925d9af29559	29c27c16-89fa-4f73-941e-29c722ed7979	Importance: Sampling distributions are important for making inferences about a population based on sample data. They help in estimating population parameters and testing hypotheses.	red	Highlight	2025-09-21 13:09:10.915591+05:30	2025-09-21 13:09:10.915591+05:30
1d669ccc-4d9a-4beb-8586-e665e79de68f	8209ee91-860e-4415-97b4-91f6f1e3b60d	39ff51ad-da1b-4efd-b159-ce1839947eed	29c27c16-89fa-4f73-941e-29c722ed7979	So, the probability is: [ P(4) = \\frac{1}{6} ]	green	\N	2025-09-21 13:17:45.569091+05:30	2025-09-21 13:17:45.569091+05:30
c7d138b4-f490-47cd-a7cc-43e9bc652d1f	0c6158e8-972b-4f7a-be85-a0711ce0232a	35a68686-6a53-4006-bd4e-925d9af29559	29c27c16-89fa-4f73-941e-29c722ed7979	If	green	\N	2025-09-21 13:26:23.218636+05:30	2025-09-21 13:26:23.218636+05:30
57de5162-d0e3-41cc-bf2f-d93b3d202f03	53ed30f6-7b66-42f4-8e35-482278885c77	54c3fb1f-00c1-43f8-aeb3-2278058f619c	29c27c16-89fa-4f73-941e-29c722ed7979	99.7% of Data: About 99.7% of the data points fall within three standard deviations of the mean. This shows that almost all data points are included within this range.	yellow	99	2025-09-21 13:26:48.359745+05:30	2025-09-21 13:27:00.349906+05:30
59902195-3279-4975-a271-4b9307a17aae	0c6158e8-972b-4f7a-be85-a0711ce0232a	35a68686-6a53-4006-bd4e-925d9af29559	29c27c16-89fa-4f73-941e-29c722ed7979	Standard Error: The standard deviation of the sampling distribution is called the standard error. It measures how much the sample mean is expected to vary from the true population mean.	red	StandardError	2025-09-21 13:27:23.155881+05:30	2025-09-21 13:27:23.155881+05:30
9903fef4-bb86-4489-ab91-d9dfce69c56f	63b8c00e-63ab-42b5-8a53-a8ce5f2a1616	7e4cce1a-c63e-441d-9dfc-b4872d86825f	29c27c16-89fa-4f73-941e-29c722ed7979	सर्वे भवन्तु सुखिनः:\n\nसर्वे भवन्तु सुखिनः।\nसर्वे सन्तु निरामयाः।\nसर्वे भद्राणि पश्यन्तु।\nमा कश्चिद्दुःखभाग्भवेत्।	red		2025-09-21 13:29:48.672839+05:30	2025-09-21 13:29:58.391192+05:30
c2757469-02b6-4df3-86a7-1043b11db1d9	0c6158e8-972b-4f7a-be85-a0711ce0232a	35a68686-6a53-4006-bd4e-925d9af29559	29c27c16-89fa-4f73-941e-29c722ed7979	questions or need	red	\N	2025-09-21 13:32:21.49438+05:30	2025-09-21 13:32:21.49438+05:30
eef0a892-b444-4df1-abb4-3a12c6d191eb	0c6158e8-972b-4f7a-be85-a0711ce0232a	35a68686-6a53-4006-bd4e-925d9af29559	29c27c16-89fa-4f73-941e-29c722ed7979	Importance: Sampling distributions are important for making inferences about a population based on sample data. They help in estimating population parameters and testing hypotheses.	green	\N	2025-09-21 13:32:29.386472+05:30	2025-09-21 13:32:29.386472+05:30
78c78cfd-4757-4f9f-876e-df2b973cd38b	0c6158e8-972b-4f7a-be85-a0711ce0232a	35a68686-6a53-4006-bd4e-925d9af29559	29c27c16-89fa-4f73-941e-29c722ed7979	A sampling distribution is a probability distribution of a statistic obtained by selecting random samples from a population. Here are some key points:	green	\N	2025-09-21 13:32:42.676519+05:30	2025-09-21 13:32:42.676519+05:30
243b8ac9-295d-41e1-85fe-850efee74dd4	0c6158e8-972b-4f7a-be85-a0711ce0232a	35a68686-6a53-4006-bd4e-925d9af29559	29c27c16-89fa-4f73-941e-29c722ed7979	Standard Error: The standard deviation of the sampling distribution is called the standard error. It measures how much the sample mean is expected to vary from the true population mean.	red	\N	2025-09-21 13:32:47.91522+05:30	2025-09-21 13:32:47.91522+05:30
6ddc2e48-2460-4f33-84bc-bddb3061d769	8209ee91-860e-4415-97b4-91f6f1e3b60d	39ff51ad-da1b-4efd-b159-ce1839947eed	29c27c16-89fa-4f73-941e-29c722ed7979	Probability is a branch of mathematics that deals with the likelihood of different outcomes. It helps us understand how likely an event is to happen. Here are some key concepts:	green	\N	2025-09-21 13:45:09.132978+05:30	2025-09-21 13:45:09.132978+05:30
5ecd4967-8a49-4012-9842-6e27c95037cd	8209ee91-860e-4415-97b4-91f6f1e3b60d	39ff51ad-da1b-4efd-b159-ce1839947eed	29c27c16-89fa-4f73-941e-29c722ed7979	Experiment: An action or process that leads to one or more outcomes. For example, flipping a coin.	red	\N	2025-09-21 13:45:26.728934+05:30	2025-09-21 13:45:26.728934+05:30
d33e5c2f-e382-4a88-a03f-dd0f6ab56a11	8209ee91-860e-4415-97b4-91f6f1e3b60d	39ff51ad-da1b-4efd-b159-ce1839947eed	29c27c16-89fa-4f73-941e-29c722ed7979	If you roll a six-sided die, the probability of rolling a 4 is:	red	\N	2025-09-21 13:45:33.009028+05:30	2025-09-21 13:45:33.009028+05:30
d21b2d47-d495-42ee-afc1-8d9eddf0007d	66217e45-83d0-45a8-a43f-442bd54cd4be	ac3c3ad9-94db-4fd0-90d6-c2e7d8caa52e	29c27c16-89fa-4f73-941e-29c722ed7979	చెట్టు నీడలో కూర్చొని,\nకథలు వినిపిస్తాయి,\nస్నేహితులందరితో కలిసి,\nఈ రోజు చాలా ఆనందంగా ఉంది!	green	\N	2025-09-21 13:49:08.613811+05:30	2025-09-21 13:49:08.613811+05:30
1644a923-b8be-4ff3-a160-b1b547f5f71a	8209ee91-860e-4415-97b4-91f6f1e3b60d	39ff51ad-da1b-4efd-b159-ce1839947eed	29c27c16-89fa-4f73-941e-29c722ed7979	Favorable outcomes: 1 (only the number 4)	red	\N	2025-09-21 14:13:02.110253+05:30	2025-09-21 14:13:02.110253+05:30
12938b18-cd45-48da-b3bf-6b366544f990	bc748858-c05b-4bb9-ab98-e67fd224eac0	ae32417c-9c5c-45bc-bfb0-ee586a1c7176	29c27c16-89fa-4f73-941e-29c722ed7979	his creates a set of unique square	#FEF3C7		2025-09-21 14:25:59.619077+05:30	2025-09-21 14:26:21.854361+05:30
533eb2ba-e021-4817-b3eb-d02971411c0e	bc748858-c05b-4bb9-ab98-e67fd224eac0	ae32417c-9c5c-45bc-bfb0-ee586a1c7176	29c27c16-89fa-4f73-941e-29c722ed7979	squares of even numbers	#FEF3C7	Add A note	2025-09-21 14:26:34.469326+05:30	2025-09-21 14:26:34.469326+05:30
940861df-3be3-4b1f-ae03-f7c746b1e8a6	bc748858-c05b-4bb9-ab98-e67fd224eac0	ae32417c-9c5c-45bc-bfb0-ee586a1c7176	29c27c16-89fa-4f73-941e-29c722ed7979	Python for creating collections	#DBEAFE	Updating the note	2025-09-21 14:27:18.346377+05:30	2025-09-21 14:31:02.781476+05:30
7776ab1f-ca09-4ea6-b4e5-142dcc66d69f	bc748858-c05b-4bb9-ab98-e67fd224eac0	ae32417c-9c5c-45bc-bfb0-ee586a1c7176	29c27c16-89fa-4f73-941e-29c722ed7979	This creates a dictionary	#FCE7F3	New Note	2025-09-21 14:29:47.280392+05:30	2025-09-21 14:31:11.522751+05:30
e6837e88-8ee1-47f5-9e9e-3be81b430cf3	bc748858-c05b-4bb9-ab98-e67fd224eac0	ae32417c-9c5c-45bc-bfb0-ee586a1c7176	29c27c16-89fa-4f73-941e-29c722ed7979	Comprehensions	#D1FAE5	Adding Notes	2025-09-21 14:38:26.350668+05:30	2025-09-21 14:38:33.905445+05:30
d9886bed-dfea-4611-a02a-983cc1d04238	bc748858-c05b-4bb9-ab98-e67fd224eac0	ae32417c-9c5c-45bc-bfb0-ee586a1c7176	29c27c16-89fa-4f73-941e-29c722ed7979	your code shorter	#FCE7F3	Hello YOu 	2025-09-21 14:46:44.257232+05:30	2025-09-21 14:46:50.248255+05:30
7d048aa7-c70d-4739-964b-a6dd86d3809e	4946eb64-4adb-40aa-aa42-19fa5d992173	badd28ad-c723-4795-b4e6-06afe18e2a94	29c27c16-89fa-4f73-941e-29c722ed7979	रामू को संगीत क्यों पसंद था?	#FCE7F3	Who Knows\n	2025-09-21 14:48:22.4476+05:30	2025-09-21 14:48:32.116784+05:30
98b1bbb8-0236-4687-abad-3f1ef81b8c13	bc748858-c05b-4bb9-ab98-e67fd224eac0	ae32417c-9c5c-45bc-bfb0-ee586a1c7176	29c27c16-89fa-4f73-941e-29c722ed7979	Dictionary Comprehension	#D1FAE5	\N	2025-09-21 15:04:58.969817+05:30	2025-09-21 15:04:58.969817+05:30
90a5fb83-eb0d-4828-9ba2-d89118209912	bc748858-c05b-4bb9-ab98-e67fd224eac0	ae32417c-9c5c-45bc-bfb0-ee586a1c7176	29c27c16-89fa-4f73-941e-29c722ed7979	You can also create dictionaries. For example:	#FCE7F3	\N	2025-09-21 15:05:02.684961+05:30	2025-09-21 15:05:02.684961+05:30
a32285cc-96a5-478b-ad51-817c674e7ea2	3af16f18-0fd4-40ee-8eea-51db617091fb	9a50b374-0940-4df3-8094-a5dc11510741	29c27c16-89fa-4f73-941e-29c722ed7979	specific news from last	#DBEAFE	Hello	2025-09-21 15:08:59.512577+05:30	2025-09-21 15:09:04.8422+05:30
f37ecb39-97b8-4ff3-a8cc-79bb72de735c	bc748858-c05b-4bb9-ab98-e67fd224eac0	ae32417c-9c5c-45bc-bfb0-ee586a1c7176	29c27c16-89fa-4f73-941e-29c722ed7979	You can create a	#FCE7F3	\N	2025-09-21 15:10:57.062624+05:30	2025-09-21 15:10:57.062624+05:30
3a7b6294-df89-4b17-8c18-97a1ad955c04	8209ee91-860e-4415-97b4-91f6f1e3b60d	39ff51ad-da1b-4efd-b159-ce1839947eed	29c27c16-89fa-4f73-941e-29c722ed7979	A possible result of an experiment.	#FCE7F3	\N	2025-09-21 16:46:56.211641+05:30	2025-09-21 16:46:56.211641+05:30
8dd07a60-e301-45ad-8f3c-fe0b8689c63b	bc748858-c05b-4bb9-ab98-e67fd224eac0	ae32417c-9c5c-45bc-bfb0-ee586a1c7176	29c27c16-89fa-4f73-941e-29c722ed7979	Similarly, you can create sets	#DBEAFE	This is note Test	2025-09-21 17:33:23.75801+05:30	2025-09-21 17:33:23.75801+05:30
bbef9c2e-294b-4c1b-a474-57ee8997976d	bc748858-c05b-4bb9-ab98-e67fd224eac0	ae32417c-9c5c-45bc-bfb0-ee586a1c7176	29c27c16-89fa-4f73-941e-29c722ed7979	more readable	#D1FAE5	New Note	2025-09-21 17:33:01.394196+05:30	2025-09-21 17:33:27.524907+05:30
31b70215-4878-431d-99cf-2f583c0a90cb	8e40f87f-59ff-470c-9703-889580f23e1c	e455adf6-c843-436a-9068-2047899768d6	29c27c16-89fa-4f73-941e-29c722ed7979	In a normal distribution, the mean (average), median (middle value), and mode (most frequent value) are all the same	#FCE7F3	All values are same	2025-09-21 17:56:49.450868+05:30	2025-09-21 17:57:19.85729+05:30
d902382e-c518-45e3-b33d-f38f1ce0fe62	8e40f87f-59ff-470c-9703-889580f23e1c	e455adf6-c843-436a-9068-2047899768d6	29c27c16-89fa-4f73-941e-29c722ed7979	The spread of the distribution is determined by the standard deviation. A smaller standard deviation means the data points are closer to the mean, while a larger standard deviation means they are spread out over a wider range.	#D1FAE5	\N	2025-09-21 17:57:27.50376+05:30	2025-09-21 17:57:27.50376+05:30
81ba173b-3546-4714-a7c4-608244311feb	8e40f87f-59ff-470c-9703-889580f23e1c	e455adf6-c843-436a-9068-2047899768d6	29c27c16-89fa-4f73-941e-29c722ed7979	If you have specific questions about normal distribution or need more details, feel free to ask!	#DBEAFE	\N	2025-09-21 18:00:15.33988+05:30	2025-09-21 18:00:15.33988+05:30
3827ffa3-b10d-4539-896e-93101d0eb6bb	8e40f87f-59ff-470c-9703-889580f23e1c	e455adf6-c843-436a-9068-2047899768d6	29c27c16-89fa-4f73-941e-29c722ed7979	Normal distribution is used in many fields, including statistics, finance, and natural and social sciences, to model	#FCE7F3	Test	2025-09-21 19:33:37.244718+05:30	2025-09-21 19:33:37.244718+05:30
\.


--
-- Data for Name: jobs; Type: TABLE DATA; Schema: public; Owner: ink
--

COPY public.jobs (id, job_type, payload, state, attempts, max_attempts, last_error, locked_at, run_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: posts; Type: TABLE DATA; Schema: public; Owner: ink
--

COPY public.posts (uri, cid, did, collection, created_at, text, rating, progress, book_id, article_url, article_title, article_source) FROM stdin;
at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.book.post/3lx5qtrzoud2w	bafyreihbwxbcn5a3tsmyeiiaqvpzod57qoresdoyzjku3ijipmse5mtmwq	did:plc:matwoj635dvtorkqxgzw7sti	com.inkreaders.book.post	2025-08-24 20:30:34+05:30		\N	\N	114	\N	\N	\N
at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.book.post/3lx5rpprj4o2v	bafyreigakuhvuac3qmksep7j6zhpik3dx7lfuuu3ituj62jcltugfkahli	did:plc:matwoj635dvtorkqxgzw7sti	com.inkreaders.book.post	2025-08-24 20:46:11+05:30		\N	\N	162	\N	\N	\N
at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.article.post/3lwvy4ia25u23	bafyreicdcqnyk3lrd7rqysig4qupqu5mplo6ediv6y7ilcyheszn4sgpkq	did:plc:matwoj635dvtorkqxgzw7sti	com.inkreaders.article.post	2025-08-21 18:19:24+05:30	Great long-read on deep work.	\N	\N	\N	https://example.com/reading-deeply	On Reading Deeply	Example Mag
at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.article.post/3lx4qyr7on42n	bafyreiequawy5deu4q5ogi7r6c7aob45veld3e4uy5cbhexcbdcz2d4roe	did:plc:matwoj635dvtorkqxgzw7sti	com.inkreaders.article.post	2025-08-24 11:00:41+05:30		\N	\N	\N	ArticleSource	ArticleTitle	
at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.book.post/3lwvy3voc3h2b	bafyreigps2hlqzw4yiigkckaqw6ts2g7hcgbtwtf2ntf4qplhyf3jqd7ci	did:plc:matwoj635dvtorkqxgzw7sti	com.inkreaders.book.post	2025-08-21 18:19:04+05:30	Re-reading a classic.	\N	\N	1	\N	\N	\N
at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.book.post/3lx4pp7ocp62v	bafyreib4jiupprxt7gvwiipdkcgbb5yhj5sek2xsdu3jnzicnfcoxqff2u	did:plc:matwoj635dvtorkqxgzw7sti	com.inkreaders.book.post	2025-08-24 10:37:27+05:30	Test from curl	\N	\N	17	\N	\N	\N
at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.book.post/3lx4qvkwuhl2l	bafyreiar7fhedulgrzhabi6i7755o4m3olu3sbkkrdfmym3aa5qajrozsq	did:plc:matwoj635dvtorkqxgzw7sti	com.inkreaders.book.post	2025-08-24 10:58:54+05:30		\N	\N	18	\N	\N	\N
at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.book.post/3lx4rgclv5z2v	bafyreihrkifdnywigdkinhlyxzypeqn7vq6bf53y6xamnd46joebp47tou	did:plc:matwoj635dvtorkqxgzw7sti	com.inkreaders.book.post	2025-08-24 11:08:16+05:30	debug book	\N	\N	19	\N	\N	\N
at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.book.post/3lx4rsturbr27	bafyreibzjwyruqblhq7gmhb3xpgip4surx4encn4kktqddstf3kuqrgxhm	did:plc:matwoj635dvtorkqxgzw7sti	com.inkreaders.book.post	2025-08-24 11:15:16+05:30	debug book	\N	\N	19	\N	\N	\N
at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.book.post/3lx53xmd6gt2v	bafyreihlzrxntp2ge3rryuz5jhtubfzd5krazxzgdnfejauxm7tvdgcuoi	did:plc:matwoj635dvtorkqxgzw7sti	com.inkreaders.book.post	2025-08-24 14:16:53+05:30		\N	\N	20	\N	\N	\N
at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.book.post/3lx5dwkswfv2v	bafyreic4d3oszvn64rl43fwvnpquz6axueibz7cclkifqjqwny5ht6enkm	did:plc:matwoj635dvtorkqxgzw7sti	com.inkreaders.book.post	2025-08-24 16:39:28+05:30	MVP check	\N	\N	31	\N	\N	\N
at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.book.post/3lx5qs7yva22l	bafyreiapiclf6ffhvqt2azrh3e3yqioofjtazitkyt5cb7olp42r6wrfzy	did:plc:matwoj635dvtorkqxgzw7sti	com.inkreaders.book.post	2025-08-24 20:29:41+05:30		\N	\N	111	\N	\N	\N
\.


--
-- Data for Name: response_versions; Type: TABLE DATA; Schema: public; Owner: ink
--

COPY public.response_versions (id, response_id, version_number, content, content_html, raw, created_at) FROM stdin;
8141c227-f86c-4dfb-afe1-e5aee97237ad	bdf6503b-9744-4785-a6ed-9f4ca696c97b	1	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "Probability Theory"}	2025-09-18 16:28:46.840482+05:30
790bbbd9-21ca-4e03-94b3-ff0e66cbc380	6d6dd611-a20d-4652-86f1-93cc28b1e1dd	1	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "Conditional Probability"}	2025-09-18 17:23:48.136633+05:30
fee6268c-6c1e-4e1f-881c-296ebf3ad54c	aed78ac6-2ebd-4f9f-8964-741fb55b31b4	1	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "Basics of Python "}	2025-09-18 23:30:21.180921+05:30
ae9ee765-f41b-47dc-a342-9d804539e720	d87d3d5e-03d2-4f20-9e98-9c48196160a5	1	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "Class one Addition"}	2025-09-18 23:52:20.160132+05:30
393437b9-e350-47e3-bd1f-039bdd4a8137	cf1cc20e-3168-4802-8109-e8f387fa5098	1	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "Build me a reading and fill in the blanks exercise for class 2 kid"}	2025-09-18 23:54:32.696461+05:30
0fe51807-7885-41b0-89ca-32ae3cc23e7a	eb0cea70-cdae-449b-a422-080770947eef	1	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "NCERT Class 2 Hindi - Sarangi - Summary and Exercise"}	2025-09-19 00:41:54.872428+05:30
95e9bb49-cb70-41e2-868f-07a7f4ad7456	97edd317-cadf-498a-8ace-e82572659561	1	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "NCERT Class 2: Anadmayi HIndi Kavita: Cheeta - Summary and Exercise"}	2025-09-19 07:15:50.846656+05:30
c6f70ccc-7f0a-462f-9958-9844432a832f	82648ef6-dc01-4adf-b540-b882d61796a5	1	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "NCERT Class 2 Hindi book - Sarangi - Summary and Exercise  of Chapter Mala ki chandi ki payal"}	2025-09-19 07:22:48.832475+05:30
74230536-f821-4c14-ae95-2fe3f72bdc2a	67d24413-b305-473b-8a9d-cc59ef587e05	1	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "Give me a good Hindi Kavita for Class 2 Kid from NCERT Hindi Book."}	2025-09-19 07:29:40.992899+05:30
db79b83b-e4a4-4432-8eaf-39d6d9328406	badd28ad-c723-4795-b4e6-06afe18e2a94	1	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "NCERT Class 2 Hindi book - Story Sarangi - Summary and Exercise in hindi"}	2025-09-19 07:36:27.203744+05:30
2fd96967-daaf-41ee-967a-73df8b2557c2	ccab2b25-a4e5-41ae-9cc5-f6aea9eddac2	1	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "NCERT - Class 6 - Deepkam Sanskrit Book - Summary and Exercise for Chapter - Atithi Devobhava In Sanskrit"}	2025-09-19 07:44:38.687261+05:30
e26acc33-3027-432d-92ee-e9e018c6b3fe	10acb293-d03d-44c5-a5ba-c1aee729b68d	1	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "NCERT - Class 6 - Deepkam Sanskrit Book - Summary and Exercise for Chapter - Atithi Devobhava In Sanskrit"}	2025-09-19 07:51:40.284462+05:30
4fdef7ec-0da6-4ea1-895a-13687ca54530	7e4cce1a-c63e-441d-9dfc-b4872d86825f	1	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "Give me few Sanskrit shlokas in Sanskrit language"}	2025-09-19 07:57:49.009609+05:30
03573766-7fdc-4b91-986c-aa47b67c730b	22be50d9-3d59-4861-b92a-4aef01731868	1	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "give me an exercise for spell for class 2"}	2025-09-19 09:26:21.250604+05:30
0c1ccb33-ce6e-4483-96ec-a64f6af9a335	9a50b374-0940-4df3-8094-a5dc11510741	1	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "current affairs on last week news"}	2025-09-19 09:28:52.624792+05:30
442ea102-d146-4669-854b-cad5b564f40d	ac3c3ad9-94db-4fd0-90d6-c2e7d8caa52e	1	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "Kids Poem in Telugu"}	2025-09-19 18:16:17.675719+05:30
b93236c6-30da-4df1-a3f2-f239053e9873	54c3fb1f-00c1-43f8-aeb3-2278058f619c	1	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "Empirical Rule of Data Science"}	2025-09-21 11:06:40.578793+05:30
d17b373d-fadb-4809-8e0a-7cef61acc453	35a68686-6a53-4006-bd4e-925d9af29559	1	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "Sampling Distribution"}	2025-09-21 11:23:03.674888+05:30
61c62244-ef25-4ab6-b878-d2ef74d9028a	39ff51ad-da1b-4efd-b159-ce1839947eed	1	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "Probability"}	2025-09-21 11:26:50.28659+05:30
dfff1ba7-4ddc-45d9-b3f1-cbaae7e70c2a	ae32417c-9c5c-45bc-bfb0-ee586a1c7176	1	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "Python Comprehension"}	2025-09-21 13:19:42.126652+05:30
68bdb9b0-5515-4514-9f1d-d8c5f036a121	e455adf6-c843-436a-9068-2047899768d6	1	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "Normal Distribution"}	2025-09-21 17:55:12.265741+05:30
\.


--
-- Data for Name: responses; Type: TABLE DATA; Schema: public; Owner: ink
--

COPY public.responses (id, topic_id, parent_response_id, author_type, content, content_html, raw, created_at, updated_at, search_vector, embedding, status, embedding_json) FROM stdin;
1add9659-2aaf-46a0-a77a-bc834ff0d6fd	45a2f64b-884b-40fc-9e17-235509720ece	\N	ai	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "Summarize eigenvalues and eigenvectors"}	2025-09-17 10:13:31.424556+05:30	2025-09-17 10:13:31.424556+05:30	'generating…':1B	\N	pending	\N
c081ad7f-3fa1-4084-93c3-c251e04db163	392dc7c6-ba9c-443e-8435-90efcb19e763	\N	ai	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "Summarize eigenvalues and eigenvectors"}	2025-09-17 15:03:45.649201+05:30	2025-09-17 15:03:45.649201+05:30	'generating…':1B	\N	pending	\N
6039c0d1-a50e-4378-963c-ebc5d8ef0a9c	45a2f64b-884b-40fc-9e17-235509720ece	\N	user	hello test	\N	{}	2025-09-17 21:11:01.843839+05:30	2025-09-17 21:11:01.843839+05:30	'hello':1B 'test':2B	\N	pending	\N
6619d1af-e93c-4338-8da6-82a76a908f6d	0dbc4491-d73c-4c60-9cdb-2f4d49734339	\N	ai	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "Probability"}	2025-09-18 12:05:41.134736+05:30	2025-09-18 12:05:41.134736+05:30	'generating…':1B	\N	pending	\N
1ee4deaf-7704-4009-b835-f1a447d6e4a4	0dbc4491-d73c-4c60-9cdb-2f4d49734339	\N	user	Tell in detail		{}	2025-09-18 12:06:06.697708+05:30	2025-09-18 12:06:06.697708+05:30	'detail':3B 'tell':1B	\N	pending	\N
bdf6503b-9744-4785-a6ed-9f4ca696c97b	bcee5cb4-cf41-4868-8134-d4f168f7321c	\N	ai	Sure! Here’s a structured overview of Probability Theory:\n\n### 1. Introduction to Probability\n- **Definition**: Probability is a branch of mathematics that deals with the likelihood of events occurring.\n- **Applications**: Used in various fields such as statistics, finance, science, and engineering.\n\n### 2. Basic Concepts\n- **Experiment**: A procedure that yields one of a possible set of outcomes.\n- **Sample Space (S)**: The set of all possible outcomes of an experiment.\n- **Event**: A subset of the sample space. An event can consist of one or more outcomes.\n\n### 3. Types of Probability\n- **Theoretical Probability**: Based on reasoning and the assumption of equally likely outcomes.\n  - Formula: P(A) = Number of favorable outcomes / Total number of outcomes\n- **Empirical Probability**: Based on observations or experiments.\n  - Formula: P(A) = Number of times event A occurs / Total number of trials\n- **Subjective Probability**: Based on personal judgment or experience.\n\n### 4. Rules of Probability\n- **Addition Rule**: For any two events A and B:\n  - P(A or B) = P(A) + P(B) - P(A and B)\n- **Multiplication Rule**: For independent events A and B:\n  - P(A and B) = P(A) * P(B)\n\n### 5. Conditional Probability\n- **Definition**: The probability of an event A given that event B has occurred.\n- **Formula**: P(A | B) = P(A and B) / P(B)\n\n### 6. Bayes' Theorem\n- A way to find a probability when we know certain other probabilities.\n- **Formula**: P(A | B) = [P(B | A) * P(A)] / P(B)\n\n### 7. Random Variables\n- **Definition**: A variable that takes on numerical values based on the outcomes of a random phenomenon.\n- **Types**:\n  - **Discrete Random Variables**: Can take on a countable number of values.\n  - **Continuous Random Variables**: Can take on an infinite number of values within a given range.\n\n### 8. Probability Distributions\n- **Discrete Probability Distribution**: Describes the probability of each possible value of a discrete random variable.\n  - Example: Binomial Distribution, Poisson Distribution\n- **Continuous Probability Distribution**: Describes the probabilities of the possible values of a continuous random variable.\n  - Example: Normal Distribution, Exponential Distribution\n\n### 9. Expected Value and Variance\n- **Expected Value (E[X])**: The long-term average value of a random variable.\n  - For discrete variables: E[X] = Σ [x * P(X = x)]\n- **Variance (Var(X))**: Measures the spread of a random variable.\n  - Formula: Var(X) = E[X²] - (E[X])²\n\n### 10. Conclusion\nProbability theory provides a framework for quantifying uncertainty and making informed decisions based on data and statistical analysis. Understanding its principles is essential for various applications in real life.\n\nIf you have specific questions or topics within probability theory that you would like to explore further, feel free to ask!	Sure! Here’s a structured overview of Probability Theory:\n\n### 1. Introduction to Probability\n- **Definition**: Probability is a branch of mathematics that deals with the likelihood of events occurring.\n- **Applications**: Used in various fields such as statistics, finance, science, and engineering.\n\n### 2. Basic Concepts\n- **Experiment**: A procedure that yields one of a possible set of outcomes.\n- **Sample Space (S)**: The set of all possible outcomes of an experiment.\n- **Event**: A subset of the sample space. An event can consist of one or more outcomes.\n\n### 3. Types of Probability\n- **Theoretical Probability**: Based on reasoning and the assumption of equally likely outcomes.\n  - Formula: P(A) = Number of favorable outcomes / Total number of outcomes\n- **Empirical Probability**: Based on observations or experiments.\n  - Formula: P(A) = Number of times event A occurs / Total number of trials\n- **Subjective Probability**: Based on personal judgment or experience.\n\n### 4. Rules of Probability\n- **Addition Rule**: For any two events A and B:\n  - P(A or B) = P(A) + P(B) - P(A and B)\n- **Multiplication Rule**: For independent events A and B:\n  - P(A and B) = P(A) * P(B)\n\n### 5. Conditional Probability\n- **Definition**: The probability of an event A given that event B has occurred.\n- **Formula**: P(A | B) = P(A and B) / P(B)\n\n### 6. Bayes' Theorem\n- A way to find a probability when we know certain other probabilities.\n- **Formula**: P(A | B) = [P(B | A) * P(A)] / P(B)\n\n### 7. Random Variables\n- **Definition**: A variable that takes on numerical values based on the outcomes of a random phenomenon.\n- **Types**:\n  - **Discrete Random Variables**: Can take on a countable number of values.\n  - **Continuous Random Variables**: Can take on an infinite number of values within a given range.\n\n### 8. Probability Distributions\n- **Discrete Probability Distribution**: Describes the probability of each possible value of a discrete random variable.\n  - Example: Binomial Distribution, Poisson Distribution\n- **Continuous Probability Distribution**: Describes the probabilities of the possible values of a continuous random variable.\n  - Example: Normal Distribution, Exponential Distribution\n\n### 9. Expected Value and Variance\n- **Expected Value (E[X])**: The long-term average value of a random variable.\n  - For discrete variables: E[X] = Σ [x * P(X = x)]\n- **Variance (Var(X))**: Measures the spread of a random variable.\n  - Formula: Var(X) = E[X²] - (E[X])²\n\n### 10. Conclusion\nProbability theory provides a framework for quantifying uncertainty and making informed decisions based on data and statistical analysis. Understanding its principles is essential for various applications in real life.\n\nIf you have specific questions or topics within probability theory that you would like to explore further, feel free to ask!	{"prompt": "Probability Theory", "source": "ai"}	2025-09-18 16:28:33.136333+05:30	2025-09-18 16:28:46.840482+05:30	'1':9B '10':367B '2':40B '3':83B '4':138B '5':179B '6':205B '7':231B '8':277B '9':320B 'addit':142B 'analysi':386B 'applic':28B,394B 'ask':418B 'assumpt':94B 'averag':333B 'b':150B,154B,158B,162B,170B,174B,178B,192B,198B,202B,204B,223B,225B,230B 'base':89B,112B,132B,242B,381B 'basic':41B 'bay':206B 'binomi':296B 'branch':17B 'certain':217B 'concept':42B 'conclus':368B 'condit':180B 'consist':77B 'continu':262B,300B,312B 'countabl':258B 'data':383B 'deal':21B 'decis':380B 'definit':13B,182B,234B 'describ':283B,303B 'discret':251B,280B,292B,340B 'distribut':279B,282B,297B,299B,302B,317B,319B 'e':327B,342B,362B,364B 'empir':110B 'engin':39B 'equal':96B 'essenti':391B 'event':26B,67B,75B,123B,147B,167B,187B,191B 'exampl':295B,315B 'expect':321B,325B 'experi':43B,66B,116B,137B 'explor':413B 'exponenti':318B 'favor':104B 'feel':415B 'field':32B 'financ':36B 'find':211B 'formula':99B,117B,195B,220B,359B 'framework':373B 'free':416B 'given':189B,275B 'here’':2B 'independ':166B 'infinit':269B 'inform':379B 'introduct':10B 'judgment':135B 'know':216B 'life':397B 'like':97B,411B 'likelihood':24B 'long':331B 'long-term':330B 'make':378B 'mathemat':19B 'measur':352B 'multipl':163B 'normal':316B 'number':102B,107B,120B,127B,259B,270B 'numer':240B 'observ':114B 'occur':27B,125B,194B 'one':48B,79B 'outcom':54B,63B,82B,98B,105B,109B,245B 'overview':5B 'p':100B,118B,151B,155B,157B,159B,171B,175B,177B,196B,199B,203B,221B,224B,227B,229B,346B 'person':134B 'phenomenon':249B 'poisson':298B 'possibl':51B,62B,288B,308B 'principl':389B 'probabl':7B,12B,14B,86B,88B,111B,131B,141B,181B,184B,213B,219B,278B,281B,285B,301B,305B,369B,406B 'procedur':45B 'provid':371B 'quantifi':375B 'question':402B 'random':232B,248B,252B,263B,293B,313B,337B,357B 'rang':276B 'real':396B 'reason':91B 'rule':139B,143B,164B 'sampl':55B,72B 'scienc':37B 'set':52B,59B 'space':56B,73B 'specif':401B 'spread':354B 'statist':35B,385B 'structur':4B 'subject':130B 'subset':69B 'sure':1B 'take':238B,255B,266B 'term':332B 'theorem':207B 'theoret':87B 'theori':8B,370B,407B 'time':122B 'topic':404B 'total':106B,126B 'trial':129B 'two':146B 'type':84B,250B 'uncertainti':376B 'understand':387B 'use':29B 'valu':241B,261B,272B,289B,309B,322B,326B,334B 'var':350B,360B 'variabl':233B,236B,253B,264B,294B,314B,338B,341B,358B 'varianc':324B,349B 'various':31B,393B 'way':209B 'within':273B,405B 'would':410B 'x':328B,343B,345B,347B,348B,351B,361B,365B 'x²':363B 'yield':47B '²':366B 'Σ':344B	\N	complete	\N
6d6dd611-a20d-4652-86f1-93cc28b1e1dd	eec16f54-06fb-4213-a11e-e27dbe05a62b	\N	ai	Conditional probability is a measure of the probability of an event occurring given that another event has already occurred. It is denoted as P(A | B), which reads "the probability of A given B." \n\n### Key Concepts\n\n1. **Definition**:\n   - The conditional probability of event A given event B is defined as:\n     \\[\n     P(A | B) = \\frac{P(A \\cap B)}{P(B)}\n     \\]\n   - Here, P(A ∩ B) is the probability that both events A and B occur, and P(B) is the probability of event B.\n\n2. **Requirements**:\n   - For P(A | B) to be defined, P(B) must be greater than 0 (i.e., event B must have a non-zero probability).\n\n3. **Interpretation**:\n   - Conditional probability helps in understanding how the probability of an event changes when we have additional information.\n\n### Example\n\nSuppose we have a standard deck of 52 playing cards. Let:\n- Event A: Drawing a heart.\n- Event B: Drawing a red card.\n\nTo find the conditional probability of drawing a heart given that a red card has been drawn, we can use the formula:\n\n1. **Calculate P(A ∩ B)**:\n   - There are 26 red cards (13 hearts and 13 diamonds), so P(A ∩ B) = P(drawing a heart) = 13/52.\n\n2. **Calculate P(B)**:\n   - P(B) = P(drawing a red card) = 26/52.\n\n3. **Apply the formula**:\n   \\[\n   P(A | B) = \\frac{P(A \\cap B)}{P(B)} = \\frac{13/52}{26/52} = \\frac{13}{26} = \\frac{1}{2}\n   \\]\n\n### Applications\n\n- **Real-world scenarios**: Conditional probability is widely used in fields such as finance, medicine, and machine learning to assess risks and make informed decisions based on prior knowledge.\n- **Bayes' Theorem**: A fundamental theorem in probability that relates conditional probabilities and is often used in statistical inference.\n\n### Summary\n\n- Conditional probability quantifies the likelihood of an event based on the occurrence of another event.\n- It is a foundational concept in probability theory with numerous applications in various fields. \n\nIf you have any specific questions or need further examples, feel free to ask!	Conditional probability is a measure of the probability of an event occurring given that another event has already occurred. It is denoted as P(A | B), which reads "the probability of A given B." \n\n### Key Concepts\n\n1. **Definition**:\n   - The conditional probability of event A given event B is defined as:\n     \\[\n     P(A | B) = \\frac{P(A \\cap B)}{P(B)}\n     \\]\n   - Here, P(A ∩ B) is the probability that both events A and B occur, and P(B) is the probability of event B.\n\n2. **Requirements**:\n   - For P(A | B) to be defined, P(B) must be greater than 0 (i.e., event B must have a non-zero probability).\n\n3. **Interpretation**:\n   - Conditional probability helps in understanding how the probability of an event changes when we have additional information.\n\n### Example\n\nSuppose we have a standard deck of 52 playing cards. Let:\n- Event A: Drawing a heart.\n- Event B: Drawing a red card.\n\nTo find the conditional probability of drawing a heart given that a red card has been drawn, we can use the formula:\n\n1. **Calculate P(A ∩ B)**:\n   - There are 26 red cards (13 hearts and 13 diamonds), so P(A ∩ B) = P(drawing a heart) = 13/52.\n\n2. **Calculate P(B)**:\n   - P(B) = P(drawing a red card) = 26/52.\n\n3. **Apply the formula**:\n   \\[\n   P(A | B) = \\frac{P(A \\cap B)}{P(B)} = \\frac{13/52}{26/52} = \\frac{13}{26} = \\frac{1}{2}\n   \\]\n\n### Applications\n\n- **Real-world scenarios**: Conditional probability is widely used in fields such as finance, medicine, and machine learning to assess risks and make informed decisions based on prior knowledge.\n- **Bayes' Theorem**: A fundamental theorem in probability that relates conditional probabilities and is often used in statistical inference.\n\n### Summary\n\n- Conditional probability quantifies the likelihood of an event based on the occurrence of another event.\n- It is a foundational concept in probability theory with numerous applications in various fields. \n\nIf you have any specific questions or need further examples, feel free to ask!	{"prompt": "Conditional Probability", "source": "ai"}	2025-09-18 17:23:37.103856+05:30	2025-09-18 17:23:48.136633+05:30	'0':100B '1':37B,175B,234B '13':186B,189B,231B '13/52':200B,228B '2':85B,201B,235B '26':183B,232B '26/52':212B,229B '3':111B,213B '52':138B 'addit':128B 'alreadi':18B 'anoth':15B,298B 'appli':214B 'applic':236B,310B 'ask':327B 'assess':256B 'b':26B,34B,47B,53B,58B,60B,65B,74B,78B,84B,90B,95B,103B,148B,180B,195B,204B,206B,219B,224B,226B 'base':262B,293B 'bay':266B 'calcul':176B,202B 'cap':57B,223B 'card':140B,152B,166B,185B,211B 'chang':124B 'concept':36B,304B 'condit':1B,40B,113B,156B,241B,275B,285B 'decis':261B 'deck':136B 'defin':49B,93B 'definit':38B 'denot':22B 'diamond':190B 'draw':144B,149B,159B,197B,208B 'drawn':169B 'event':11B,16B,43B,46B,71B,83B,102B,123B,142B,147B,292B,299B 'exampl':130B,323B 'feel':324B 'field':247B,313B 'financ':250B 'find':154B 'formula':174B,216B 'foundat':303B 'frac':54B,220B,227B,230B,233B 'free':325B 'fundament':269B 'given':13B,33B,45B,162B 'greater':98B 'heart':146B,161B,187B,199B 'help':115B 'i.e':101B 'infer':283B 'inform':129B,260B 'interpret':112B 'key':35B 'knowledg':265B 'learn':254B 'let':141B 'likelihood':289B 'machin':253B 'make':259B 'measur':5B 'medicin':251B 'must':96B,104B 'need':321B 'non':108B 'non-zero':107B 'numer':309B 'occur':12B,19B,75B 'occurr':296B 'often':279B 'p':24B,51B,55B,59B,62B,77B,88B,94B,177B,192B,196B,203B,205B,207B,217B,221B,225B 'play':139B 'prior':264B 'probabl':2B,8B,30B,41B,68B,81B,110B,114B,120B,157B,242B,272B,276B,286B,306B 'quantifi':287B 'question':319B 'read':28B 'real':238B 'real-world':237B 'red':151B,165B,184B,210B 'relat':274B 'requir':86B 'risk':257B 'scenario':240B 'specif':318B 'standard':135B 'statist':282B 'summari':284B 'suppos':131B 'theorem':267B,270B 'theori':307B 'understand':117B 'use':172B,245B,280B 'various':312B 'wide':244B 'world':239B 'zero':109B '∩':64B,179B,194B	\N	complete	\N
ed4a549b-4313-4cab-af2c-6267c9e7ad6f	eec16f54-06fb-4213-a11e-e27dbe05a62b	\N	user	Looks Good		{}	2025-09-18 23:23:37.339962+05:30	2025-09-18 23:23:37.339962+05:30	'good':2B 'look':1B	\N	pending	\N
aed78ac6-2ebd-4f9f-8964-741fb55b31b4	3ab87c1a-4545-4296-b7b0-b0f30c03b0eb	\N	ai	Sure! Here’s a structured overview of the basics of Python:\n\n### 1. Introduction to Python\n- **What is Python?**\n  - Python is a high-level, interpreted programming language known for its readability and simplicity.\n  - It supports multiple programming paradigms, including procedural, object-oriented, and functional programming.\n\n### 2. Setting Up Python\n- **Installation:**\n  - Download Python from the official website: [python.org](https://www.python.org/downloads/).\n  - Follow the installation instructions for your operating system (Windows, macOS, Linux).\n\n- **Running Python:**\n  - You can run Python scripts in various ways:\n    - Using the Python interpreter in the command line.\n    - Writing scripts in a text editor and running them via the command line.\n    - Using Integrated Development Environments (IDEs) like PyCharm, VSCode, or Jupyter Notebook.\n\n### 3. Basic Syntax\n- **Comments:**\n  - Single-line comment: `# This is a comment`\n  - Multi-line comment: \n    ```python\n    """\n    This is a \n    multi-line comment\n    """\n    ```\n\n- **Variables:**\n  - Variables are created by assigning a value:\n    ```python\n    x = 10\n    name = "Alice"\n    ```\n\n- **Data Types:**\n  - Common data types include:\n    - Integers: `int`\n    - Floating-point numbers: `float`\n    - Strings: `str`\n    - Booleans: `bool`\n    - Lists: `list`\n    - Tuples: `tuple`\n    - Dictionaries: `dict`\n\n### 4. Control Structures\n- **Conditional Statements:**\n  ```python\n  if condition:\n      # code to execute if condition is true\n  elif another_condition:\n      # code to execute if another_condition is true\n  else:\n      # code to execute if none of the above conditions are true\n  ```\n\n- **Loops:**\n  - **For Loop:**\n    ```python\n    for i in range(5):\n        print(i)  # Prints numbers 0 to 4\n    ```\n  - **While Loop:**\n    ```python\n    while condition:\n        # code to execute while condition is true\n    ```\n\n### 5. Functions\n- **Defining Functions:**\n  ```python\n  def function_name(parameters):\n      # code to execute\n      return value\n  ```\n\n- **Calling Functions:**\n  ```python\n  result = function_name(arguments)\n  ```\n\n### 6. Data Structures\n- **Lists:**\n  ```python\n  my_list = [1, 2, 3, 4]\n  my_list.append(5)  # Adds 5 to the list\n  ```\n\n- **Dictionaries:**\n  ```python\n  my_dict = {"key1": "value1", "key2": "value2"}\n  print(my_dict["key1"])  # Outputs: value1\n  ```\n\n### 7. Modules and Libraries\n- **Importing Modules:**\n  ```python\n  import math\n  print(math.sqrt(16))  # Outputs: 4.0\n  ```\n\n- **Using Libraries:**\n  - Python has a rich ecosystem of libraries for various tasks (e.g., NumPy for numerical computations, Pandas for data manipulation).\n\n### 8. Exception Handling\n- **Try and Except:**\n  ```python\n  try:\n      # code that may raise an exception\n  except ExceptionType:\n      # code to handle the exception\n  ```\n\n### 9. File Handling\n- **Reading and Writing Files:**\n  ```python\n  with open('file.txt', 'r') as file:\n      content = file.read()\n  \n  with open('file.txt', 'w') as file:\n      file.write("Hello, World!")\n  ```\n\n### 10. Conclusion\n- Python is versatile and widely used in web development, data analysis, artificial intelligence, scientific computing, and more.\n- Practice is key to mastering Python. Start with small projects and gradually increase complexity.\n\n### Resources for Further Learning\n- Official Python Documentation: [docs.python.org](https://docs.python.org/3/)\n- Online Courses: Platforms like Coursera, edX, and Udemy offer Python courses.\n- Books: "Automate the Boring Stuff with Python" and "Python Crash Course" are great for beginners.\n\nFeel free to ask if you have any specific questions or need further clarification on any topic!	Sure! Here’s a structured overview of the basics of Python:\n\n### 1. Introduction to Python\n- **What is Python?**\n  - Python is a high-level, interpreted programming language known for its readability and simplicity.\n  - It supports multiple programming paradigms, including procedural, object-oriented, and functional programming.\n\n### 2. Setting Up Python\n- **Installation:**\n  - Download Python from the official website: [python.org](https://www.python.org/downloads/).\n  - Follow the installation instructions for your operating system (Windows, macOS, Linux).\n\n- **Running Python:**\n  - You can run Python scripts in various ways:\n    - Using the Python interpreter in the command line.\n    - Writing scripts in a text editor and running them via the command line.\n    - Using Integrated Development Environments (IDEs) like PyCharm, VSCode, or Jupyter Notebook.\n\n### 3. Basic Syntax\n- **Comments:**\n  - Single-line comment: `# This is a comment`\n  - Multi-line comment: \n    ```python\n    """\n    This is a \n    multi-line comment\n    """\n    ```\n\n- **Variables:**\n  - Variables are created by assigning a value:\n    ```python\n    x = 10\n    name = "Alice"\n    ```\n\n- **Data Types:**\n  - Common data types include:\n    - Integers: `int`\n    - Floating-point numbers: `float`\n    - Strings: `str`\n    - Booleans: `bool`\n    - Lists: `list`\n    - Tuples: `tuple`\n    - Dictionaries: `dict`\n\n### 4. Control Structures\n- **Conditional Statements:**\n  ```python\n  if condition:\n      # code to execute if condition is true\n  elif another_condition:\n      # code to execute if another_condition is true\n  else:\n      # code to execute if none of the above conditions are true\n  ```\n\n- **Loops:**\n  - **For Loop:**\n    ```python\n    for i in range(5):\n        print(i)  # Prints numbers 0 to 4\n    ```\n  - **While Loop:**\n    ```python\n    while condition:\n        # code to execute while condition is true\n    ```\n\n### 5. Functions\n- **Defining Functions:**\n  ```python\n  def function_name(parameters):\n      # code to execute\n      return value\n  ```\n\n- **Calling Functions:**\n  ```python\n  result = function_name(arguments)\n  ```\n\n### 6. Data Structures\n- **Lists:**\n  ```python\n  my_list = [1, 2, 3, 4]\n  my_list.append(5)  # Adds 5 to the list\n  ```\n\n- **Dictionaries:**\n  ```python\n  my_dict = {"key1": "value1", "key2": "value2"}\n  print(my_dict["key1"])  # Outputs: value1\n  ```\n\n### 7. Modules and Libraries\n- **Importing Modules:**\n  ```python\n  import math\n  print(math.sqrt(16))  # Outputs: 4.0\n  ```\n\n- **Using Libraries:**\n  - Python has a rich ecosystem of libraries for various tasks (e.g., NumPy for numerical computations, Pandas for data manipulation).\n\n### 8. Exception Handling\n- **Try and Except:**\n  ```python\n  try:\n      # code that may raise an exception\n  except ExceptionType:\n      # code to handle the exception\n  ```\n\n### 9. File Handling\n- **Reading and Writing Files:**\n  ```python\n  with open('file.txt', 'r') as file:\n      content = file.read()\n  \n  with open('file.txt', 'w') as file:\n      file.write("Hello, World!")\n  ```\n\n### 10. Conclusion\n- Python is versatile and widely used in web development, data analysis, artificial intelligence, scientific computing, and more.\n- Practice is key to mastering Python. Start with small projects and gradually increase complexity.\n\n### Resources for Further Learning\n- Official Python Documentation: [docs.python.org](https://docs.python.org/3/)\n- Online Courses: Platforms like Coursera, edX, and Udemy offer Python courses.\n- Books: "Automate the Boring Stuff with Python" and "Python Crash Course" are great for beginners.\n\nFeel free to ask if you have any specific questions or need further clarification on any topic!	{"prompt": "Basics of Python ", "source": "ai"}	2025-09-18 23:29:59.494747+05:30	2025-09-18 23:30:21.180921+05:30	'/3/)':417B '/downloads/).':60B '0':225B '1':11B,268B '10':148B,374B '16':304B '2':46B,269B '3':114B,270B '4':174B,227B,271B '4.0':306B '5':220B,240B,273B,275B '6':261B '7':293B '8':328B '9':349B 'add':274B 'alic':150B 'analysi':386B 'anoth':190B,196B 'argument':260B 'artifici':387B 'ask':447B 'assign':143B 'autom':430B 'basic':8B,115B 'beginn':443B 'book':429B 'bool':167B 'boolean':166B 'bore':432B 'call':254B 'clarif':457B 'code':182B,192B,201B,233B,249B,336B,344B 'command':88B,101B 'comment':117B,121B,125B,129B,137B 'common':153B 'complex':406B 'comput':323B,390B 'conclus':375B 'condit':177B,181B,186B,191B,197B,209B,232B,237B 'content':363B 'control':175B 'cours':419B,428B,439B 'coursera':422B 'crash':438B 'creat':141B 'data':151B,154B,262B,326B,385B 'def':245B 'defin':242B 'develop':105B,384B 'dict':173B,282B,289B 'dictionari':172B,279B 'docs.python.org':414B,416B 'docs.python.org/3/)':415B 'document':413B 'download':51B 'e.g':319B 'ecosystem':313B 'editor':95B 'edx':423B 'elif':189B 'els':200B 'environ':106B 'except':329B,333B,341B,342B,348B 'exceptiontyp':343B 'execut':184B,194B,203B,235B,251B 'feel':444B 'file':350B,355B,362B,370B 'file.read':364B 'file.txt':359B,367B 'file.write':371B 'float':160B,163B 'floating-point':159B 'follow':61B 'free':445B 'function':44B,241B,243B,246B,255B,258B 'gradual':404B 'great':441B 'handl':330B,346B,351B 'hello':372B 'here’':2B 'high':22B 'high-level':21B 'ide':107B 'import':297B,300B 'includ':38B,156B 'increas':405B 'instal':50B,63B 'instruct':64B 'int':158B 'integ':157B 'integr':104B 'intellig':388B 'interpret':24B,85B 'introduct':12B 'jupyt':112B 'key':395B 'key1':283B,290B 'key2':285B 'known':27B 'languag':26B 'learn':410B 'level':23B 'librari':296B,308B,315B 'like':108B,421B 'line':89B,102B,120B,128B,136B 'linux':71B 'list':168B,169B,264B,267B,278B 'loop':212B,214B,229B 'maco':70B 'manipul':327B 'master':397B 'math':301B 'math.sqrt':303B 'may':338B 'modul':294B,298B 'multi':127B,135B 'multi-lin':126B,134B 'multipl':35B 'my_list.append':272B 'name':149B,247B,259B 'need':455B 'none':205B 'notebook':113B 'number':162B,224B 'numer':322B 'numpi':320B 'object':41B 'object-ori':40B 'offer':426B 'offici':55B,411B 'onlin':418B 'open':358B,366B 'oper':67B 'orient':42B 'output':291B,305B 'overview':5B 'panda':324B 'paradigm':37B 'paramet':248B 'platform':420B 'point':161B 'practic':393B 'print':221B,223B,287B,302B 'procedur':39B 'program':25B,36B,45B 'project':402B 'pycharm':109B 'python':10B,14B,17B,18B,49B,52B,73B,77B,84B,130B,146B,179B,215B,230B,244B,256B,265B,280B,299B,309B,334B,356B,376B,398B,412B,427B,435B,437B 'python.org':57B 'question':453B 'r':360B 'rais':339B 'rang':219B 'read':352B 'readabl':30B 'resourc':407B 'result':257B 'return':252B 'rich':312B 'run':72B,76B,97B 'scientif':389B 'script':78B,91B 'set':47B 'simplic':32B 'singl':119B 'single-lin':118B 'small':401B 'specif':452B 'start':399B 'statement':178B 'str':165B 'string':164B 'structur':4B,176B,263B 'stuff':433B 'support':34B 'sure':1B 'syntax':116B 'system':68B 'task':318B 'text':94B 'topic':460B 'tri':331B,335B 'true':188B,199B,211B,239B 'tupl':170B,171B 'type':152B,155B 'udemi':425B 'use':82B,103B,307B,381B 'valu':145B,253B 'value1':284B,292B 'value2':286B 'variabl':138B,139B 'various':80B,317B 'versatil':378B 'via':99B 'vscode':110B 'w':368B 'way':81B 'web':383B 'websit':56B 'wide':380B 'window':69B 'world':373B 'write':90B,354B 'www.python.org':59B 'www.python.org/downloads/).':58B 'x':147B	\N	complete	\N
d87d3d5e-03d2-4f20-9e98-9c48196160a5	18064fbe-5a1a-4ac2-80f5-6e4a81afde4b	\N	ai	Sure! Here are some simple addition problems suitable for a first-grade level:\n\n### Basic Addition Problems\n\n1. **1 + 1 = ?**\n   - Answer: 2\n\n2. **2 + 3 = ?**\n   - Answer: 5\n\n3. **4 + 2 = ?**\n   - Answer: 6\n\n4. **5 + 5 = ?**\n   - Answer: 10\n\n5. **3 + 6 = ?**\n   - Answer: 9\n\n### Word Problems\n\n1. **If you have 2 apples and you get 3 more apples, how many apples do you have in total?**\n   - Answer: 5 apples\n\n2. **There are 4 birds on a tree. 2 more birds join them. How many birds are there now?**\n   - Answer: 6 birds\n\n3. **You have 1 toy car, and your friend gives you 4 more. How many toy cars do you have?**\n   - Answer: 5 toy cars\n\n### Practice Problems\n\nTry solving these on your own:\n\n1. 7 + 2 = ?\n2. 3 + 4 = ?\n3. 6 + 1 = ?\n4. 8 + 0 = ?\n5. 5 + 3 = ?\n\n### Answers to Practice Problems\n\n1. 9\n2. 7\n3. 7\n4. 8\n5. 8\n\nFeel free to ask if you need more examples or explanations!	Sure! Here are some simple addition problems suitable for a first-grade level:\n\n### Basic Addition Problems\n\n1. **1 + 1 = ?**\n   - Answer: 2\n\n2. **2 + 3 = ?**\n   - Answer: 5\n\n3. **4 + 2 = ?**\n   - Answer: 6\n\n4. **5 + 5 = ?**\n   - Answer: 10\n\n5. **3 + 6 = ?**\n   - Answer: 9\n\n### Word Problems\n\n1. **If you have 2 apples and you get 3 more apples, how many apples do you have in total?**\n   - Answer: 5 apples\n\n2. **There are 4 birds on a tree. 2 more birds join them. How many birds are there now?**\n   - Answer: 6 birds\n\n3. **You have 1 toy car, and your friend gives you 4 more. How many toy cars do you have?**\n   - Answer: 5 toy cars\n\n### Practice Problems\n\nTry solving these on your own:\n\n1. 7 + 2 = ?\n2. 3 + 4 = ?\n3. 6 + 1 = ?\n4. 8 + 0 = ?\n5. 5 + 3 = ?\n\n### Answers to Practice Problems\n\n1. 9\n2. 7\n3. 7\n4. 8\n5. 8\n\nFeel free to ask if you need more examples or explanations!	{"prompt": "Class one Addition", "source": "ai"}	2025-09-18 23:52:11.723369+05:30	2025-09-18 23:52:20.160132+05:30	'0':133B '1':18B,19B,20B,45B,93B,122B,130B,141B '10':37B '2':22B,23B,24B,30B,49B,68B,76B,124B,125B,143B '3':25B,28B,39B,54B,90B,126B,128B,136B,145B '4':29B,33B,71B,101B,127B,131B,147B '5':27B,34B,35B,38B,66B,111B,134B,135B,149B '6':32B,40B,88B,129B '7':123B,144B,146B '8':132B,148B,150B '9':42B,142B 'addit':6B,16B 'answer':21B,26B,31B,36B,41B,65B,87B,110B,137B 'appl':50B,56B,59B,67B 'ask':154B 'basic':15B 'bird':72B,78B,83B,89B 'car':95B,106B,113B 'exampl':159B 'explan':161B 'feel':151B 'first':12B 'first-grad':11B 'free':152B 'friend':98B 'get':53B 'give':99B 'grade':13B 'join':79B 'level':14B 'mani':58B,82B,104B 'need':157B 'practic':114B,139B 'problem':7B,17B,44B,115B,140B 'simpl':5B 'solv':117B 'suitabl':8B 'sure':1B 'total':64B 'toy':94B,105B,112B 'tree':75B 'tri':116B 'word':43B	\N	complete	\N
cf1cc20e-3168-4802-8109-e8f387fa5098	df2dc1da-9f1f-4cb3-8173-5155d13a5b8d	\N	ai	Sure! Here’s a simple reading passage followed by a fill-in-the-blanks exercise suitable for a second-grade student.\n\n---\n\n### Reading Passage\n\n**My Day at the Park**\n\nToday, I went to the park with my friends. We played on the swings and slid down the big slide. The sun was shining, and the birds were singing. We had a picnic with sandwiches and juice. After eating, we played a game of tag. I was very happy because I love spending time with my friends at the park.\n\n### Fill in the Blanks\n\nFill in the blanks with the correct words from the box below.\n\n**Word Bank:** park, swings, picnic, happy, birds\n\n1. Today, I went to the _______ with my friends.\n2. We played on the _______ and slid down the big slide.\n3. The sun was shining, and the _______ were singing.\n4. We had a _______ with sandwiches and juice.\n5. I was very _______ because I love spending time with my friends.\n\n---\n\n### Answers\n\n1. park\n2. swings\n3. birds\n4. picnic\n5. happy\n\nFeel free to print this out or use it in your class!	Sure! Here’s a simple reading passage followed by a fill-in-the-blanks exercise suitable for a second-grade student.\n\n---\n\n### Reading Passage\n\n**My Day at the Park**\n\nToday, I went to the park with my friends. We played on the swings and slid down the big slide. The sun was shining, and the birds were singing. We had a picnic with sandwiches and juice. After eating, we played a game of tag. I was very happy because I love spending time with my friends at the park.\n\n### Fill in the Blanks\n\nFill in the blanks with the correct words from the box below.\n\n**Word Bank:** park, swings, picnic, happy, birds\n\n1. Today, I went to the _______ with my friends.\n2. We played on the _______ and slid down the big slide.\n3. The sun was shining, and the _______ were singing.\n4. We had a _______ with sandwiches and juice.\n5. I was very _______ because I love spending time with my friends.\n\n---\n\n### Answers\n\n1. park\n2. swings\n3. birds\n4. picnic\n5. happy\n\nFeel free to print this out or use it in your class!	{"prompt": "Build me a reading and fill in the blanks exercise for class 2 kid", "source": "ai"}	2025-09-18 23:54:27.642205+05:30	2025-09-18 23:54:32.696461+05:30	'1':113B,163B '2':122B,165B '3':133B,167B '4':142B,169B '5':150B,171B 'answer':162B 'bank':107B 'big':48B,131B 'bird':56B,112B,168B 'blank':14B,93B,97B 'box':104B 'class':184B 'correct':100B 'day':26B 'eat':68B 'exercis':15B 'feel':173B 'fill':11B,90B,94B 'fill-in-the-blank':10B 'follow':7B 'free':174B 'friend':38B,86B,121B,161B 'game':72B 'grade':21B 'happi':78B,111B,172B 'here’':2B 'juic':66B,149B 'love':81B,156B 'park':29B,35B,89B,108B,164B 'passag':6B,24B 'picnic':62B,110B,170B 'play':40B,70B,124B 'print':176B 'read':5B,23B 'sandwich':64B,147B 'second':20B 'second-grad':19B 'shine':53B,137B 'simpl':4B 'sing':58B,141B 'slid':45B,128B 'slide':49B,132B 'spend':82B,157B 'student':22B 'suitabl':16B 'sun':51B,135B 'sure':1B 'swing':43B,109B,166B 'tag':74B 'time':83B,158B 'today':30B,114B 'use':180B 'went':32B,116B 'word':101B,106B	\N	complete	\N
eb0cea70-cdae-449b-a422-080770947eef	73536fd2-dacf-4ac9-8966-4e8b2f1e7dca	\N	ai	### NCERT Class 2 Hindi - Sarangi\n\n#### Summary of "Sarangi"\n\n"Sarangi" is a beautiful story that revolves around the life of a musician and his beloved instrument, the sarangi. The sarangi is a traditional Indian string instrument known for its soulful sound. The story highlights the deep connection between the musician and his instrument, showcasing how music can express emotions and bring joy to people's lives.\n\nThe musician spends his days playing the sarangi, filling the air with melodious tunes. His music resonates with the hearts of those who listen, bringing happiness and peace. The story emphasizes the importance of art and music in our lives, illustrating how they can uplift spirits and create bonds among people.\n\nThrough the narrative, children learn about the value of creativity, passion, and the joy that music can bring. The story encourages them to appreciate the beauty of music and the role it plays in cultural traditions.\n\n#### Exercises\n\n1. **Comprehension Questions:**\n   - Who is the main character in the story?\n   - What instrument does the musician play?\n   - How does the music of the sarangi affect the listeners?\n\n2. **Fill in the Blanks:**\n   - The musician plays the __________.\n   - The sound of the sarangi is __________.\n   - Music can bring __________ to people's lives.\n\n3. **True or False:**\n   - The sarangi is a type of drum. (True/False)\n   - The musician is happy when he plays his instrument. (True/False)\n   - The story teaches us about the importance of music. (True/False)\n\n4. **Creative Activity:**\n   - Draw a picture of a musician playing the sarangi.\n   - Write a few lines about your favorite musical instrument and how it makes you feel.\n\n5. **Discussion:**\n   - Talk about a time when you listened to music that made you feel happy. What was the music, and how did it affect you?\n\n### Conclusion\n\nThe story of "Sarangi" not only entertains but also educates young readers about the significance of music in our lives. Through engaging exercises, children can reflect on the themes of the story and express their creativity.	### NCERT Class 2 Hindi - Sarangi\n\n#### Summary of "Sarangi"\n\n"Sarangi" is a beautiful story that revolves around the life of a musician and his beloved instrument, the sarangi. The sarangi is a traditional Indian string instrument known for its soulful sound. The story highlights the deep connection between the musician and his instrument, showcasing how music can express emotions and bring joy to people's lives.\n\nThe musician spends his days playing the sarangi, filling the air with melodious tunes. His music resonates with the hearts of those who listen, bringing happiness and peace. The story emphasizes the importance of art and music in our lives, illustrating how they can uplift spirits and create bonds among people.\n\nThrough the narrative, children learn about the value of creativity, passion, and the joy that music can bring. The story encourages them to appreciate the beauty of music and the role it plays in cultural traditions.\n\n#### Exercises\n\n1. **Comprehension Questions:**\n   - Who is the main character in the story?\n   - What instrument does the musician play?\n   - How does the music of the sarangi affect the listeners?\n\n2. **Fill in the Blanks:**\n   - The musician plays the __________.\n   - The sound of the sarangi is __________.\n   - Music can bring __________ to people's lives.\n\n3. **True or False:**\n   - The sarangi is a type of drum. (True/False)\n   - The musician is happy when he plays his instrument. (True/False)\n   - The story teaches us about the importance of music. (True/False)\n\n4. **Creative Activity:**\n   - Draw a picture of a musician playing the sarangi.\n   - Write a few lines about your favorite musical instrument and how it makes you feel.\n\n5. **Discussion:**\n   - Talk about a time when you listened to music that made you feel happy. What was the music, and how did it affect you?\n\n### Conclusion\n\nThe story of "Sarangi" not only entertains but also educates young readers about the significance of music in our lives. Through engaging exercises, children can reflect on the themes of the story and express their creativity.	{"prompt": "NCERT Class 2 Hindi - Sarangi - Summary and Exercise", "source": "ai"}	2025-09-19 00:41:45.467573+05:30	2025-09-19 00:41:54.872428+05:30	'1':154B '2':3B,181B '3':203B '4':235B '5':262B 'activ':237B 'affect':178B,286B 'air':76B 'also':297B 'among':115B 'appreci':140B 'around':16B 'art':100B 'beauti':12B,142B 'belov':24B 'blank':185B 'bond':114B 'bring':60B,90B,134B,198B 'charact':161B 'children':120B,312B 'class':2B 'comprehens':155B 'conclus':288B 'connect':46B 'creat':113B 'creativ':126B,236B,324B 'cultur':151B 'day':70B 'deep':45B 'discuss':263B 'draw':238B 'drum':213B 'educ':298B 'emot':58B 'emphas':96B 'encourag':137B 'engag':310B 'entertain':295B 'exercis':153B,311B 'express':57B,322B 'fals':206B 'favorit':253B 'feel':261B,276B 'fill':74B,182B 'happi':91B,218B,277B 'heart':85B 'highlight':43B 'hindi':4B 'illustr':106B 'import':98B,231B 'indian':33B 'instrument':25B,35B,52B,166B,223B,255B 'joy':61B,130B 'known':36B 'learn':121B 'life':18B 'line':250B 'listen':89B,180B,270B 'live':65B,105B,202B,308B 'made':274B 'main':160B 'make':259B 'melodi':78B 'music':55B,81B,102B,132B,144B,174B,196B,233B,254B,272B,281B,305B 'musician':21B,49B,67B,169B,187B,216B,243B 'narrat':119B 'ncert':1B 'passion':127B 'peac':93B 'peopl':63B,116B,200B 'pictur':240B 'play':71B,149B,170B,188B,221B,244B 'question':156B 'reader':300B 'reflect':314B 'reson':82B 'revolv':15B 'role':147B 'sarangi':5B,8B,9B,27B,29B,73B,177B,194B,208B,246B,292B 'showcas':53B 'signific':303B 'soul':39B 'sound':40B,191B 'spend':68B 'spirit':111B 'stori':13B,42B,95B,136B,164B,226B,290B,320B 'string':34B 'summari':6B 'talk':264B 'teach':227B 'theme':317B 'time':267B 'tradit':32B,152B 'true':204B 'true/false':214B,224B,234B 'tune':79B 'type':211B 'uplift':110B 'us':228B 'valu':124B 'write':247B 'young':299B	\N	complete	\N
97edd317-cadf-498a-8ace-e82572659561	217dbafd-6eb6-47c7-9a73-68e615a52797	\N	ai	### NCERT Class 2: Anadmayi Hindi Kavita - "Cheeta"\n\n#### Summary:\nThe poem "Cheeta" is a delightful piece that introduces young readers to the characteristics and traits of a cheetah, which is known for its speed and agility. The poem describes how the cheetah moves swiftly across the plains, showcasing its grace and strength. It highlights the cheetah's ability to run faster than any other animal, making it a fascinating creature in the animal kingdom. The poem uses simple language and vivid imagery to engage children, encouraging them to appreciate the beauty and uniqueness of wildlife.\n\n#### Key Themes:\n- **Speed and Agility**: The cheetah is celebrated for its incredible speed.\n- **Nature and Wildlife**: The poem fosters an appreciation for animals and their habitats.\n- **Imagination**: Encourages children to visualize the cheetah in its natural environment.\n\n### Exercises:\n\n#### 1. Comprehension Questions:\n- What is the main focus of the poem "Cheeta"?\n- Describe one characteristic of the cheetah mentioned in the poem.\n- Why do you think the cheetah is considered a special animal?\n\n#### 2. Vocabulary:\n- Find and write down three new words from the poem and their meanings.\n\n#### 3. Creative Activity:\n- Draw a picture of a cheetah in its natural habitat. Write a few sentences about what the cheetah is doing in your drawing.\n\n#### 4. Fill in the Blanks:\n- The cheetah is known for its ________.\n- It can run faster than ________.\n- The cheetah lives in ________.\n\n#### 5. True or False:\n- The cheetah is the slowest animal in the jungle. (True/False)\n- Cheetahs can be found in grasslands and savannas. (True/False)\n\n### Conclusion:\nThe poem "Cheeta" serves as an engaging introduction to the world of animals for young learners. Through fun exercises and creative activities, children can deepen their understanding and appreciation of nature.	### NCERT Class 2: Anadmayi Hindi Kavita - "Cheeta"\n\n#### Summary:\nThe poem "Cheeta" is a delightful piece that introduces young readers to the characteristics and traits of a cheetah, which is known for its speed and agility. The poem describes how the cheetah moves swiftly across the plains, showcasing its grace and strength. It highlights the cheetah's ability to run faster than any other animal, making it a fascinating creature in the animal kingdom. The poem uses simple language and vivid imagery to engage children, encouraging them to appreciate the beauty and uniqueness of wildlife.\n\n#### Key Themes:\n- **Speed and Agility**: The cheetah is celebrated for its incredible speed.\n- **Nature and Wildlife**: The poem fosters an appreciation for animals and their habitats.\n- **Imagination**: Encourages children to visualize the cheetah in its natural environment.\n\n### Exercises:\n\n#### 1. Comprehension Questions:\n- What is the main focus of the poem "Cheeta"?\n- Describe one characteristic of the cheetah mentioned in the poem.\n- Why do you think the cheetah is considered a special animal?\n\n#### 2. Vocabulary:\n- Find and write down three new words from the poem and their meanings.\n\n#### 3. Creative Activity:\n- Draw a picture of a cheetah in its natural habitat. Write a few sentences about what the cheetah is doing in your drawing.\n\n#### 4. Fill in the Blanks:\n- The cheetah is known for its ________.\n- It can run faster than ________.\n- The cheetah lives in ________.\n\n#### 5. True or False:\n- The cheetah is the slowest animal in the jungle. (True/False)\n- Cheetahs can be found in grasslands and savannas. (True/False)\n\n### Conclusion:\nThe poem "Cheeta" serves as an engaging introduction to the world of animals for young learners. Through fun exercises and creative activities, children can deepen their understanding and appreciation of nature.	{"prompt": "NCERT Class 2: Anadmayi HIndi Kavita: Cheeta - Summary and Exercise", "source": "ai"}	2025-09-19 07:15:42.645109+05:30	2025-09-19 07:15:50.846656+05:30	'1':133B '2':3B,166B '3':181B '4':207B '5':227B 'abil':57B 'across':44B 'activ':183B,272B 'agil':35B,99B 'anadmayi':4B 'anim':64B,72B,117B,165B,236B,263B 'appreci':88B,115B,279B 'beauti':90B 'blank':211B 'celebr':103B 'characterist':22B,147B 'cheeta':7B,11B,144B,253B 'cheetah':27B,41B,55B,101B,127B,150B,160B,189B,201B,213B,224B,232B,241B 'children':84B,123B,273B 'class':2B 'comprehens':134B 'conclus':250B 'consid':162B 'creativ':182B,271B 'creatur':69B 'deepen':275B 'delight':14B 'describ':38B,145B 'draw':184B,206B 'encourag':85B,122B 'engag':83B,257B 'environ':131B 'exercis':132B,269B 'fals':230B 'fascin':68B 'faster':60B,221B 'fill':208B 'find':168B 'focus':140B 'foster':113B 'found':244B 'fun':268B 'grace':49B 'grassland':246B 'habitat':120B,193B 'highlight':53B 'hindi':5B 'imageri':81B 'imagin':121B 'incred':106B 'introduc':17B 'introduct':258B 'jungl':239B 'kavita':6B 'key':95B 'kingdom':73B 'known':30B,215B 'languag':78B 'learner':266B 'live':225B 'main':139B 'make':65B 'mean':180B 'mention':151B 'move':42B 'natur':108B,130B,192B,281B 'ncert':1B 'new':173B 'one':146B 'pictur':186B 'piec':15B 'plain':46B 'poem':10B,37B,75B,112B,143B,154B,177B,252B 'question':135B 'reader':19B 'run':59B,220B 'savanna':248B 'sentenc':197B 'serv':254B 'showcas':47B 'simpl':77B 'slowest':235B 'special':164B 'speed':33B,97B,107B 'strength':51B 'summari':8B 'swift':43B 'theme':96B 'think':158B 'three':172B 'trait':24B 'true':228B 'true/false':240B,249B 'understand':277B 'uniqu':92B 'use':76B 'visual':125B 'vivid':80B 'vocabulari':167B 'wildlif':94B,110B 'word':174B 'world':261B 'write':170B,194B 'young':18B,265B	\N	complete	\N
776583f4-4386-45cb-91ce-bf67f3315a62	83eb71fb-c711-4f74-8677-617e01758cc5	\N	ai	Generating…		{"note": "placeholder - initial response will be generated async", "prompt": "NCERT Class 2 Hindi - Sarangi - Summary and Exercise"}	2025-09-19 07:16:47.627999+05:30	2025-09-19 07:16:47.627999+05:30	'generating…':1B	\N	pending	\N
82648ef6-dc01-4adf-b540-b882d61796a5	6b5f8282-fdf5-4107-a203-9a50a0dd94a1	\N	ai	### Chapter Summary: "Mala ki Chandi ki Payal"\n\n- **Story Overview**: The chapter revolves around a girl who receives a beautiful silver anklet (payal) as a gift. The anklet is shiny and makes a pleasant sound when she walks. She feels very happy and proud of her new accessory.\n\n- **Themes**:\n  - **Joy of Gifts**: The happiness that comes from receiving something special.\n  - **Value of Simple Things**: The story emphasizes appreciating small joys in life.\n\n- **Characters**:\n  - The girl: Main character who cherishes her anklet.\n  - Family members: They admire her anklet and share in her joy.\n\n### Exercises\n\n1. **Comprehension Questions**:\n   - What did the girl receive as a gift?\n   - How did the anklet make her feel?\n   - Describe the sound of the anklet.\n\n2. **Fill in the Blanks**:\n   - The girl received a _______ (chandi ki payal).\n   - The payal makes a _______ sound.\n\n3. **True or False**:\n   - The girl was sad about the anklet. (True/False)\n   - The anklet was made of gold. (True/False)\n\n4. **Drawing Activity**:\n   - Draw a picture of the girl wearing her silver anklet.\n\n5. **Creative Writing**:\n   - Write a few sentences about a gift you received and how it made you feel.\n\nThese exercises will help reinforce the understanding of the chapter and encourage creativity and expression.	### Chapter Summary: "Mala ki Chandi ki Payal"\n\n- **Story Overview**: The chapter revolves around a girl who receives a beautiful silver anklet (payal) as a gift. The anklet is shiny and makes a pleasant sound when she walks. She feels very happy and proud of her new accessory.\n\n- **Themes**:\n  - **Joy of Gifts**: The happiness that comes from receiving something special.\n  - **Value of Simple Things**: The story emphasizes appreciating small joys in life.\n\n- **Characters**:\n  - The girl: Main character who cherishes her anklet.\n  - Family members: They admire her anklet and share in her joy.\n\n### Exercises\n\n1. **Comprehension Questions**:\n   - What did the girl receive as a gift?\n   - How did the anklet make her feel?\n   - Describe the sound of the anklet.\n\n2. **Fill in the Blanks**:\n   - The girl received a _______ (chandi ki payal).\n   - The payal makes a _______ sound.\n\n3. **True or False**:\n   - The girl was sad about the anklet. (True/False)\n   - The anklet was made of gold. (True/False)\n\n4. **Drawing Activity**:\n   - Draw a picture of the girl wearing her silver anklet.\n\n5. **Creative Writing**:\n   - Write a few sentences about a gift you received and how it made you feel.\n\nThese exercises will help reinforce the understanding of the chapter and encourage creativity and expression.	{"prompt": "NCERT Class 2 Hindi book - Sarangi - Summary and Exercise  of Chapter Mala ki chandi ki payal", "source": "ai"}	2025-09-19 07:22:42.647507+05:30	2025-09-19 07:22:48.832475+05:30	'1':93B '2':117B '3':134B '4':153B '5':166B 'accessori':47B 'activ':155B 'admir':84B 'anklet':21B,27B,80B,86B,107B,116B,144B,147B,165B 'appreci':67B 'around':13B 'beauti':19B 'blank':121B 'chandi':5B,126B 'chapter':1B,11B,193B 'charact':72B,76B 'cherish':78B 'come':55B 'comprehens':94B 'creativ':167B,196B 'describ':111B 'draw':154B,156B 'emphas':66B 'encourag':195B 'exercis':92B,185B 'express':198B 'fals':137B 'famili':81B 'feel':39B,110B,183B 'fill':118B 'gift':25B,51B,103B,175B 'girl':15B,74B,99B,123B,139B,161B 'gold':151B 'happi':41B,53B 'help':187B 'joy':49B,69B,91B 'ki':4B,6B,127B 'life':71B 'made':149B,181B 'main':75B 'make':31B,108B,131B 'mala':3B 'member':82B 'new':46B 'overview':9B 'payal':7B,22B,128B,130B 'pictur':158B 'pleasant':33B 'proud':43B 'question':95B 'receiv':17B,57B,100B,124B,177B 'reinforc':188B 'revolv':12B 'sad':141B 'sentenc':172B 'share':88B 'shini':29B 'silver':20B,164B 'simpl':62B 'small':68B 'someth':58B 'sound':34B,113B,133B 'special':59B 'stori':8B,65B 'summari':2B 'theme':48B 'thing':63B 'true':135B 'true/false':145B,152B 'understand':190B 'valu':60B 'walk':37B 'wear':162B 'write':168B,169B	\N	complete	\N
ccab2b25-a4e5-41ae-9cc5-f6aea9eddac2	364f0430-f341-4db1-ab17-c0e4f1a4ae3e	\N	ai	### Summary of "Atithi Devobhava"\n\n"Atithi Devobhava" is a Sanskrit chapter that emphasizes the importance of hospitality and respect towards guests. The phrase translates to "The guest is God," highlighting the cultural belief that treating guests with honor and kindness is a virtue. \n\nThe chapter discusses various aspects of hospitality, including:\n\n1. **Respect for Guests**: It teaches that guests should be treated with utmost respect, as they bring joy and blessings to the household.\n2. **Cultural Significance**: The text reflects the traditional Indian values of welcoming and serving guests, which is an integral part of the culture.\n3. **Moral Lessons**: It conveys moral lessons about generosity, kindness, and the importance of community.\n\n### Exercises\n\n1. **Translation Exercise**: Translate the following sentences into Sanskrit:\n   - "A guest is like a god."\n   - "We should serve our guests with love."\n\n2. **Short Answer Questions**:\n   - What does "Atithi Devobhava" mean?\n   - Why is it important to treat guests well?\n\n3. **Fill in the Blanks**:\n   - Atithi Devobhava means "The guest is ______."\n   - In our culture, guests are treated with ______.\n\n4. **Essay Writing**: Write a short essay on the importance of hospitality in your family or community.\n\n5. **Discussion Questions**:\n   - How do you feel when you are a guest in someone’s home?\n   - Share an experience where you felt welcomed as a guest.\n\nThese exercises aim to reinforce the values discussed in the chapter and encourage students to reflect on their own experiences with hospitality.	### Summary of "Atithi Devobhava"\n\n"Atithi Devobhava" is a Sanskrit chapter that emphasizes the importance of hospitality and respect towards guests. The phrase translates to "The guest is God," highlighting the cultural belief that treating guests with honor and kindness is a virtue. \n\nThe chapter discusses various aspects of hospitality, including:\n\n1. **Respect for Guests**: It teaches that guests should be treated with utmost respect, as they bring joy and blessings to the household.\n2. **Cultural Significance**: The text reflects the traditional Indian values of welcoming and serving guests, which is an integral part of the culture.\n3. **Moral Lessons**: It conveys moral lessons about generosity, kindness, and the importance of community.\n\n### Exercises\n\n1. **Translation Exercise**: Translate the following sentences into Sanskrit:\n   - "A guest is like a god."\n   - "We should serve our guests with love."\n\n2. **Short Answer Questions**:\n   - What does "Atithi Devobhava" mean?\n   - Why is it important to treat guests well?\n\n3. **Fill in the Blanks**:\n   - Atithi Devobhava means "The guest is ______."\n   - In our culture, guests are treated with ______.\n\n4. **Essay Writing**: Write a short essay on the importance of hospitality in your family or community.\n\n5. **Discussion Questions**:\n   - How do you feel when you are a guest in someone’s home?\n   - Share an experience where you felt welcomed as a guest.\n\nThese exercises aim to reinforce the values discussed in the chapter and encourage students to reflect on their own experiences with hospitality.	{"prompt": "NCERT - Class 6 - Deepkam Sanskrit Book - Summary and Exercise for Chapter - Atithi Devobhava In Sanskrit", "source": "ai"}	2025-09-19 07:44:31.334886+05:30	2025-09-19 07:44:38.687261+05:30	'1':51B,113B '2':74B,135B '3':97B,152B '4':170B '5':187B 'aim':214B 'answer':137B 'aspect':47B 'atithi':3B,5B,141B,157B 'belief':32B 'blank':156B 'bless':70B 'bring':67B 'chapter':10B,44B,222B 'communiti':111B,186B 'convey':101B 'cultur':31B,75B,96B,165B 'devobhava':4B,6B,142B,158B 'discuss':45B,188B,219B 'emphas':12B 'encourag':224B 'essay':171B,176B 'exercis':112B,115B,213B 'experi':204B,231B 'famili':184B 'feel':193B 'felt':207B 'fill':153B 'follow':118B 'generos':105B 'god':28B,127B 'guest':20B,26B,35B,54B,58B,88B,123B,132B,150B,161B,166B,198B,211B 'highlight':29B 'home':201B 'honor':37B 'hospit':16B,49B,181B,233B 'household':73B 'import':14B,109B,147B,179B 'includ':50B 'indian':82B 'integr':92B 'joy':68B 'kind':39B,106B 'lesson':99B,103B 'like':125B 'love':134B 'mean':143B,159B 'moral':98B,102B 'part':93B 'phrase':22B 'question':138B,189B 'reflect':79B,227B 'reinforc':216B 'respect':18B,52B,64B 'sanskrit':9B,121B 'sentenc':119B 'serv':87B,130B 'share':202B 'short':136B,175B 'signific':76B 'someone’':200B 'student':225B 'summari':1B 'teach':56B 'text':78B 'toward':19B 'tradit':81B 'translat':23B,114B,116B 'treat':34B,61B,149B,168B 'utmost':63B 'valu':83B,218B 'various':46B 'virtu':42B 'welcom':85B,208B 'well':151B 'write':172B,173B	\N	complete	\N
67d24413-b305-473b-8a9d-cc59ef587e05	dbfd1914-ccd1-452c-88a7-79a0eb1667c2	\N	ai	Here is a simple Hindi poem suitable for a Class 2 student, inspired by themes often found in NCERT Hindi books:\n\n**चाँद और तारे**\n\nचाँद निकला आसमान में,  \nचमकता है सबको भाए।  \nतारे भी उसके संग हैं,  \nरात की रौनक बढ़ाए।\n\nचाँद की चाँदनी बिखरे,  \nसपनों में सबको ले जाए।  \nबच्चे सब सो जाएं,  \nचाँद और तारे मुस्कुराए।\n\nयह कविता बच्चों को चाँद और तारे की सुंदरता के बारे में बताती है और रात की शांति का अनुभव कराती है।	Here is a simple Hindi poem suitable for a Class 2 student, inspired by themes often found in NCERT Hindi books:\n\n**चाँद और तारे**\n\nचाँद निकला आसमान में,  \nचमकता है सबको भाए।  \nतारे भी उसके संग हैं,  \nरात की रौनक बढ़ाए।\n\nचाँद की चाँदनी बिखरे,  \nसपनों में सबको ले जाए।  \nबच्चे सब सो जाएं,  \nचाँद और तारे मुस्कुराए।\n\nयह कविता बच्चों को चाँद और तारे की सुंदरता के बारे में बताती है और रात की शांति का अनुभव कराती है।	{"prompt": "Give me a good Hindi Kavita for Class 2 Kid from NCERT Hindi Book.", "source": "ai"}	2025-09-19 07:29:34.753912+05:30	2025-09-19 07:29:40.992899+05:30	'2':11B 'book':21B 'class':10B 'found':17B 'hindi':5B,20B 'inspir':13B 'ncert':19B 'often':16B 'poem':6B 'simpl':4B 'student':12B 'suitabl':7B 'theme':15B 'अनुभव':78B 'आसमान':27B 'उसके':35B 'और':23B,56B,64B,73B 'कराती':79B 'कविता':60B 'का':77B 'की':39B,43B,66B,75B 'के':68B 'को':62B 'चमकता':29B 'चाँद':22B,25B,42B,55B,63B 'चाँदनी':44B 'जाएं':54B 'जाए।':50B 'तारे':24B,33B,57B,65B 'निकला':26B 'बच्चे':51B 'बच्चों':61B 'बढ़ाए।':41B 'बताती':71B 'बारे':69B 'बिखरे':45B 'भाए।':32B 'भी':34B 'मुस्कुराए।':58B 'में':28B,47B,70B 'यह':59B 'रात':38B,74B 'रौनक':40B 'ले':49B 'शांति':76B 'संग':36B 'सपनों':46B 'सब':52B 'सबको':31B,48B 'सुंदरता':67B 'सो':53B 'है':30B,72B 'हैं':37B 'है।':80B	\N	complete	\N
badd28ad-c723-4795-b4e6-06afe18e2a94	4946eb64-4adb-40aa-aa42-19fa5d992173	\N	ai	### कहानी सारंगी - सारांश\n\nकहानी "सारंगी" एक छोटे से गाँव की है, जहाँ एक गरीब लड़का रहता है। उसका नाम रामू है। रामू को संगीत बहुत पसंद है, लेकिन उसके पास कोई वाद्य यंत्र नहीं है। एक दिन, वह एक पुरानी सारंगी पाता है। वह सारंगी को साफ करता है और उसे बजाना सीखता है। \n\nरामू की सारंगी की आवाज़ इतनी मधुर होती है कि गाँव के लोग उसे सुनने के लिए इकट्ठा होते हैं। उसकी संगीत से गाँव में खुशी फैल जाती है। रामू की मेहनत और लगन से वह एक अच्छे संगीतकार बन जाता है। कहानी हमें यह सिखाती है कि अगर हम मेहनत करें और अपने सपनों का पीछा करें, तो हम सफल हो सकते हैं।\n\n### व्यायाम\n\n1. **प्रश्न उत्तर:**\n   - रामू को संगीत क्यों पसंद था?\n   - रामू ने सारंगी कैसे पाई?\n   - रामू की सारंगी की आवाज़ सुनकर गाँव के लोग कैसे प्रतिक्रिया करते हैं?\n\n2. **शब्दावली:**\n   - सारंगी\n   - संगीत\n   - गाँव\n   - गरीब\n   - मधुर\n\n3. **रचनात्मक लेखन:**\n   - अपने पसंदीदा वाद्य यंत्र के बारे में एक छोटी सी कहानी लिखें।\n   - अगर आपके पास एक जादुई वाद्य यंत्र होता, तो आप उससे क्या करते?\n\n4. **चित्र बनाना:**\n   - रामू और उसकी सारंगी का चित्र बनाएं। \n\nइन प्रश्नों और गतिविधियों के माध्यम से बच्चे कहानी को बेहतर समझ सकते हैं और अपनी रचनात्मकता को भी विकसित कर सकते हैं।	### कहानी सारंगी - सारांश\n\nकहानी "सारंगी" एक छोटे से गाँव की है, जहाँ एक गरीब लड़का रहता है। उसका नाम रामू है। रामू को संगीत बहुत पसंद है, लेकिन उसके पास कोई वाद्य यंत्र नहीं है। एक दिन, वह एक पुरानी सारंगी पाता है। वह सारंगी को साफ करता है और उसे बजाना सीखता है। \n\nरामू की सारंगी की आवाज़ इतनी मधुर होती है कि गाँव के लोग उसे सुनने के लिए इकट्ठा होते हैं। उसकी संगीत से गाँव में खुशी फैल जाती है। रामू की मेहनत और लगन से वह एक अच्छे संगीतकार बन जाता है। कहानी हमें यह सिखाती है कि अगर हम मेहनत करें और अपने सपनों का पीछा करें, तो हम सफल हो सकते हैं।\n\n### व्यायाम\n\n1. **प्रश्न उत्तर:**\n   - रामू को संगीत क्यों पसंद था?\n   - रामू ने सारंगी कैसे पाई?\n   - रामू की सारंगी की आवाज़ सुनकर गाँव के लोग कैसे प्रतिक्रिया करते हैं?\n\n2. **शब्दावली:**\n   - सारंगी\n   - संगीत\n   - गाँव\n   - गरीब\n   - मधुर\n\n3. **रचनात्मक लेखन:**\n   - अपने पसंदीदा वाद्य यंत्र के बारे में एक छोटी सी कहानी लिखें।\n   - अगर आपके पास एक जादुई वाद्य यंत्र होता, तो आप उससे क्या करते?\n\n4. **चित्र बनाना:**\n   - रामू और उसकी सारंगी का चित्र बनाएं। \n\nइन प्रश्नों और गतिविधियों के माध्यम से बच्चे कहानी को बेहतर समझ सकते हैं और अपनी रचनात्मकता को भी विकसित कर सकते हैं।	{"prompt": "NCERT Class 2 Hindi book - Story Sarangi - Summary and Exercise in hindi", "source": "ai"}	2025-09-19 07:36:16.724507+05:30	2025-09-19 07:36:27.203744+05:30	'1':120B '2':147B '3':154B '4':182B 'अगर':103B,169B 'अच्छे':92B 'अपनी':207B 'अपने':108B,157B 'आप':178B 'आपके':170B 'आवाज़':59B,138B 'इकट्ठा':72B 'इतनी':60B 'इन':192B 'उत्तर':122B 'उसका':18B 'उसकी':75B,187B 'उसके':29B 'उससे':179B 'उसे':51B,68B 'एक':6B,13B,36B,39B,91B,164B,172B 'और':50B,87B,107B,186B,194B,206B 'कर':212B 'करता':48B 'करते':145B,181B 'करें':106B,112B 'कहानी':1B,4B,97B,167B,200B 'का':110B,189B 'कि':64B,102B 'की':10B,56B,58B,85B,135B,137B 'के':66B,70B,141B,161B,196B 'कैसे':132B,143B 'को':23B,46B,124B,201B,209B 'कोई':31B 'क्या':180B 'क्यों':126B 'खुशी':80B 'गतिविधियों':195B 'गरीब':14B,152B 'गाँव':9B,65B,78B,140B,151B 'चित्र':183B,190B 'छोटी':165B 'छोटे':7B 'जहाँ':12B 'जाता':95B 'जाती':82B 'जादुई':173B 'तो':113B,177B 'था':128B 'दिन':37B 'नहीं':34B 'नाम':19B 'ने':130B 'पसंद':26B,127B 'पसंदीदा':158B 'पाई':133B 'पाता':42B 'पास':30B,171B 'पीछा':111B 'पुरानी':40B 'प्रतिक्रिया':144B 'प्रश्न':121B 'प्रश्नों':193B 'फैल':81B 'बच्चे':199B 'बजाना':52B 'बन':94B 'बनाएं।':191B 'बनाना':184B 'बहुत':25B 'बारे':162B 'बेहतर':202B 'भी':210B 'मधुर':61B,153B 'माध्यम':197B 'में':79B,163B 'मेहनत':86B,105B 'यंत्र':33B,160B,175B 'यह':99B 'रचनात्मक':155B 'रचनात्मकता':208B 'रहता':16B 'रामू':20B,22B,55B,84B,123B,129B,134B,185B 'लगन':88B 'लड़का':15B 'लिए':71B 'लिखें।':168B 'लेकिन':28B 'लेखन':156B 'लोग':67B,142B 'वह':38B,44B,90B 'वाद्य':32B,159B,174B 'विकसित':211B 'व्यायाम':119B 'शब्दावली':148B 'संगीत':24B,76B,125B,150B 'संगीतकार':93B 'सकते':117B,204B,213B 'सपनों':109B 'सफल':115B 'समझ':203B 'साफ':47B 'सारंगी':2B,5B,41B,45B,57B,131B,136B,149B,188B 'सारांश':3B 'सिखाती':100B 'सी':166B 'सीखता':53B 'सुनकर':139B 'सुनने':69B 'से':8B,77B,89B,198B 'हम':104B,114B 'हमें':98B 'है':11B,27B,49B,63B,101B 'हैं':146B,205B 'हैं।':74B,118B,214B 'है।':17B,21B,35B,43B,54B,83B,96B 'हो':116B 'होता':176B 'होती':62B 'होते':73B	\N	complete	\N
10acb293-d03d-44c5-a5ba-c1aee729b68d	7c6fc3d8-ebc7-47b0-8ec7-479bd16d65f8	\N	ai	### अध्याय: अतिथि देवो भव\n\n#### सारांश:\n"अतिथि देवो भव" संस्कृत में एक महत्वपूर्ण विचार है। इसका अर्थ है कि अतिथि (मेहमान) को भगवान के समान मानना चाहिए। इस अध्याय में यह बताया गया है कि हमें अपने अतिथियों का सम्मान कैसे करना चाहिए। जब कोई मेहमान हमारे घर आता है, तो हमें उसे खुशी से स्वागत करना चाहिए और उसकी आवश्यकताओं का ध्यान रखना चाहिए। \n\nइस अध्याय में यह भी बताया गया है कि अतिथि का स्वागत करना हमारी संस्कृति का एक महत्वपूर्ण हिस्सा है। हमें अपने मेहमानों के साथ अच्छे व्यवहार करना चाहिए और उन्हें अपने घर में आरामदायक महसूस कराना चाहिए।\n\n#### अभ्यास प्रश्न:\n\n1. "अतिथि देवो भव" का क्या अर्थ है?\n2. हमें अपने अतिथियों का सम्मान क्यों करना चाहिए?\n3. मेहमानों का स्वागत करने के लिए हमें क्या करना चाहिए?\n4. इस अध्याय से हमें क्या सीखने को मिलता है?\n\n#### उत्तर:\n1. "अतिथि देवो भव" का अर्थ है कि मेहमान को भगवान के समान मानना चाहिए।\n2. हमें अपने अतिथियों का सम्मान करना चाहिए क्योंकि यह हमारी संस्कृति का हिस्सा है और यह हमारे अच्छे संस्कार को दर्शाता है।\n3. मेहमानों का स्वागत करने के लिए हमें उन्हें अच्छे से मिलना चाहिए, उनकी आवश्यकताओं का ध्यान रखना चाहिए और उन्हें आरामदायक महसूस कराना चाहिए।\n4. इस अध्याय से हमें यह सीखने को मिलता है कि हमें सभी लोगों का सम्मान करना चाहिए, चाहे वे हमारे मेहमान हों या कोई और।\n\nयह अध्याय हमें सिखाता है कि मेहमानों के प्रति हमारी जिम्मेदारी और आदर होना चाहिए।	### अध्याय: अतिथि देवो भव\n\n#### सारांश:\n"अतिथि देवो भव" संस्कृत में एक महत्वपूर्ण विचार है। इसका अर्थ है कि अतिथि (मेहमान) को भगवान के समान मानना चाहिए। इस अध्याय में यह बताया गया है कि हमें अपने अतिथियों का सम्मान कैसे करना चाहिए। जब कोई मेहमान हमारे घर आता है, तो हमें उसे खुशी से स्वागत करना चाहिए और उसकी आवश्यकताओं का ध्यान रखना चाहिए। \n\nइस अध्याय में यह भी बताया गया है कि अतिथि का स्वागत करना हमारी संस्कृति का एक महत्वपूर्ण हिस्सा है। हमें अपने मेहमानों के साथ अच्छे व्यवहार करना चाहिए और उन्हें अपने घर में आरामदायक महसूस कराना चाहिए।\n\n#### अभ्यास प्रश्न:\n\n1. "अतिथि देवो भव" का क्या अर्थ है?\n2. हमें अपने अतिथियों का सम्मान क्यों करना चाहिए?\n3. मेहमानों का स्वागत करने के लिए हमें क्या करना चाहिए?\n4. इस अध्याय से हमें क्या सीखने को मिलता है?\n\n#### उत्तर:\n1. "अतिथि देवो भव" का अर्थ है कि मेहमान को भगवान के समान मानना चाहिए।\n2. हमें अपने अतिथियों का सम्मान करना चाहिए क्योंकि यह हमारी संस्कृति का हिस्सा है और यह हमारे अच्छे संस्कार को दर्शाता है।\n3. मेहमानों का स्वागत करने के लिए हमें उन्हें अच्छे से मिलना चाहिए, उनकी आवश्यकताओं का ध्यान रखना चाहिए और उन्हें आरामदायक महसूस कराना चाहिए।\n4. इस अध्याय से हमें यह सीखने को मिलता है कि हमें सभी लोगों का सम्मान करना चाहिए, चाहे वे हमारे मेहमान हों या कोई और।\n\nयह अध्याय हमें सिखाता है कि मेहमानों के प्रति हमारी जिम्मेदारी और आदर होना चाहिए।	{"prompt": "NCERT - Class 6 - Deepkam Sanskrit Book - Summary and Exercise for Chapter - Atithi Devobhava In Sanskrit", "source": "ai"}	2025-09-19 07:51:30.251356+05:30	2025-09-19 07:51:40.284462+05:30	'1':105B,144B '2':113B,159B '3':122B,182B '4':133B,207B 'अच्छे':90B,177B,191B 'अतिथि':2B,6B,19B,74B,106B,145B 'अतिथियों':37B,116B,162B 'अध्याय':1B,28B,66B,135B,209B,234B 'अपने':36B,86B,96B,115B,161B 'अभ्यास':103B 'अर्थ':16B,111B,149B 'आता':48B 'आदर':245B 'आरामदायक':99B,203B 'आवश्यकताओं':60B,196B 'इस':27B,65B,134B,208B 'इसका':15B 'उत्तर':143B 'उनकी':195B 'उन्हें':95B,190B,202B 'उसकी':59B 'उसे':52B 'एक':11B,81B 'और':58B,94B,174B,201B,244B 'और।':232B 'करना':41B,56B,77B,92B,120B,131B,165B,223B 'करने':126B,186B 'कराना':101B,205B 'का':38B,61B,75B,80B,109B,117B,124B,148B,163B,171B,184B,197B,221B 'कि':18B,34B,73B,151B,217B,238B 'के':23B,88B,127B,155B,187B,240B 'कैसे':40B 'को':21B,140B,153B,179B,214B 'कोई':44B,231B 'क्या':110B,130B,138B 'क्यों':119B 'क्योंकि':167B 'खुशी':53B 'गया':32B,71B 'घर':47B,97B 'चाहिए':57B,93B,121B,132B,166B,194B,200B,224B 'चाहिए।':26B,42B,64B,102B,158B,206B,247B 'चाहे':225B 'जब':43B 'जिम्मेदारी':243B 'तो':50B 'दर्शाता':180B 'देवो':3B,7B,107B,146B 'ध्यान':62B,198B 'प्रति':241B 'प्रश्न':104B 'बताया':31B,70B 'भगवान':22B,154B 'भव':4B,8B,108B,147B 'भी':69B 'महत्वपूर्ण':12B,82B 'महसूस':100B,204B 'मानना':25B,157B 'मिलता':141B,215B 'मिलना':193B 'में':10B,29B,67B,98B 'मेहमान':20B,45B,152B,228B 'मेहमानों':87B,123B,183B,239B 'यह':30B,68B,168B,175B,212B,233B 'या':230B 'रखना':63B,199B 'लिए':128B,188B 'लोगों':220B 'विचार':13B 'वे':226B 'व्यवहार':91B 'संस्कार':178B 'संस्कृत':9B 'संस्कृति':79B,170B 'सभी':219B 'समान':24B,156B 'सम्मान':39B,118B,164B,222B 'साथ':89B 'सारांश':5B 'सिखाता':236B 'सीखने':139B,213B 'से':54B,136B,192B,210B 'स्वागत':55B,76B,125B,185B 'हमारी':78B,169B,242B 'हमारे':46B,176B,227B 'हमें':35B,51B,85B,114B,129B,137B,160B,189B,211B,218B,235B 'हिस्सा':83B,172B 'है':17B,33B,49B,72B,112B,142B,150B,173B,216B,237B 'है।':14B,84B,181B 'हों':229B 'होना':246B	\N	complete	\N
7e4cce1a-c63e-441d-9dfc-b4872d86825f	63b8c00e-63ab-42b5-8a53-a8ce5f2a1616	\N	ai	यहाँ कुछ संस्कृत श्लोक दिए गए हैं:\n\n1. **गायत्री मंत्र:**\n   ```\n   ॐ भूर्भुवः स्वः\n   तत्सवितुर्वरेण्यं\n   भर्गो देवस्य धीमहि\n   धियो यो नः प्रचोदयात्।\n   ```\n\n2. **शान्ति मंत्र:**\n   ```\n   ॐ सह नाववतु।\n   सह नौ भुनक्तु।\n   सह वीर्यं करवावहै।\n   तेजस्विनावधीतमस्तु मा विद्विषावहै।\n   ॐ शान्तिः शान्तिः शान्तिः।\n   ```\n\n3. **सर्वे भवन्तु सुखिनः:**\n   ```\n   सर्वे भवन्तु सुखिनः।\n   सर्वे सन्तु निरामयाः।\n   सर्वे भद्राणि पश्यन्तु।\n   मा कश्चिद्दुःखभाग्भवेत्।\n   ```\n\n4. **कृष्णाय वासुदेवाय:**\n   ```\n   कृष्णाय वासुदेवाय\n   हरये परमात्मने।\n   प्रणत क्लेशनाशाय\n   गोविन्दाय नमो नमः।\n   ```\n\nइन श्लोकों का उपयोग ध्यान, प्रार्थना और शांति के लिए किया जाता है।	यहाँ कुछ संस्कृत श्लोक दिए गए हैं:\n\n1. **गायत्री मंत्र:**\n   ```\n   ॐ भूर्भुवः स्वः\n   तत्सवितुर्वरेण्यं\n   भर्गो देवस्य धीमहि\n   धियो यो नः प्रचोदयात्।\n   ```\n\n2. **शान्ति मंत्र:**\n   ```\n   ॐ सह नाववतु।\n   सह नौ भुनक्तु।\n   सह वीर्यं करवावहै।\n   तेजस्विनावधीतमस्तु मा विद्विषावहै।\n   ॐ शान्तिः शान्तिः शान्तिः।\n   ```\n\n3. **सर्वे भवन्तु सुखिनः:**\n   ```\n   सर्वे भवन्तु सुखिनः।\n   सर्वे सन्तु निरामयाः।\n   सर्वे भद्राणि पश्यन्तु।\n   मा कश्चिद्दुःखभाग्भवेत्।\n   ```\n\n4. **कृष्णाय वासुदेवाय:**\n   ```\n   कृष्णाय वासुदेवाय\n   हरये परमात्मने।\n   प्रणत क्लेशनाशाय\n   गोविन्दाय नमो नमः।\n   ```\n\nइन श्लोकों का उपयोग ध्यान, प्रार्थना और शांति के लिए किया जाता है।	{"prompt": "Give me few Sanskrit shlokas in Sanskrit language", "source": "ai"}	2025-09-19 07:57:39.439005+05:30	2025-09-19 07:57:49.009609+05:30	'1':8B '2':22B '3':41B '4':56B 'इन':68B 'उपयोग':71B 'और':74B 'करवावहै।':33B 'कश्चिद्दुःखभाग्भवेत्।':55B 'का':70B 'किया':78B 'कुछ':2B 'कृष्णाय':57B,59B 'के':76B 'क्लेशनाशाय':64B 'गए':6B 'गायत्री':9B 'गोविन्दाय':65B 'जाता':79B 'तत्सवितुर्वरेण्यं':14B 'तेजस्विनावधीतमस्तु':34B 'दिए':5B 'देवस्य':16B 'धियो':18B 'धीमहि':17B 'ध्यान':72B 'नः':20B 'नमः।':67B 'नमो':66B 'नाववतु।':27B 'निरामयाः।':50B 'नौ':29B 'परमात्मने।':62B 'पश्यन्तु।':53B 'प्रचोदयात्।':21B 'प्रणत':63B 'प्रार्थना':73B 'भद्राणि':52B 'भर्गो':15B 'भवन्तु':43B,46B 'भुनक्तु।':30B 'भूर्भुवः':12B 'मंत्र':10B,24B 'मा':35B,54B 'यहाँ':1B 'यो':19B 'लिए':77B 'वासुदेवाय':58B,60B 'विद्विषावहै।':36B 'वीर्यं':32B 'शांति':75B 'शान्ति':23B 'शान्तिः':38B,39B 'शान्तिः।':40B 'श्लोक':4B 'श्लोकों':69B 'संस्कृत':3B 'सन्तु':49B 'सर्वे':42B,45B,48B,51B 'सह':26B,28B,31B 'सुखिनः':44B 'सुखिनः।':47B 'स्वः':13B 'हरये':61B 'हैं':7B 'है।':80B 'ॐ':11B,25B,37B	\N	complete	\N
22be50d9-3d59-4861-b92a-4aef01731868	327ab1c4-1d61-44c3-9dd1-331de1f7fe71	\N	ai	Here’s a simple spelling exercise for class 2:\n\n### Spelling Exercise\n\n**Words to Practice:**\n1. Cat\n2. Dog\n3. Sun\n4. Hat\n5. Tree\n\n**Instructions:**\n1. Write each word three times.\n2. Use each word in a sentence.\n\n**Example:**\n- Cat: The cat is sleeping.\n  \n### Bonus Activity:\nDraw a picture of one of the words! \n\nHappy spelling!	Here’s a simple spelling exercise for class 2:\n\n### Spelling Exercise\n\n**Words to Practice:**\n1. Cat\n2. Dog\n3. Sun\n4. Hat\n5. Tree\n\n**Instructions:**\n1. Write each word three times.\n2. Use each word in a sentence.\n\n**Example:**\n- Cat: The cat is sleeping.\n  \n### Bonus Activity:\nDraw a picture of one of the words! \n\nHappy spelling!	{"prompt": "give me an exercise for spell for class 2", "source": "ai"}	2025-09-19 09:26:18.226511+05:30	2025-09-19 09:26:21.250604+05:30	'1':14B,25B '2':8B,16B,31B '3':18B '4':20B '5':22B 'activ':45B 'bonus':44B 'cat':15B,39B,41B 'class':7B 'dog':17B 'draw':46B 'exampl':38B 'exercis':5B,10B 'happi':54B 'hat':21B 'here’':1B 'instruct':24B 'one':50B 'pictur':48B 'practic':13B 'sentenc':37B 'simpl':3B 'sleep':43B 'spell':4B,9B,55B 'sun':19B 'three':29B 'time':30B 'tree':23B 'use':32B 'word':11B,28B,34B,53B 'write':26B	\N	complete	\N
9a50b374-0940-4df3-8094-a5dc11510741	3af16f18-0fd4-40ee-8eea-51db617091fb	\N	ai	I am not sure about the specific news from last week as my information is only up to October 2023. However, you can check reliable news websites or apps for the latest updates on current affairs. They usually have sections dedicated to the most recent news.	I am not sure about the specific news from last week as my information is only up to October 2023. However, you can check reliable news websites or apps for the latest updates on current affairs. They usually have sections dedicated to the most recent news.	{"prompt": "current affairs on last week news", "source": "ai"}	2025-09-19 09:28:49.494177+05:30	2025-09-19 09:28:52.624792+05:30	'2023':20B 'affair':36B 'app':29B 'check':24B 'current':35B 'dedic':41B 'howev':21B 'inform':14B 'last':10B 'latest':32B 'news':8B,26B,46B 'octob':19B 'recent':45B 'reliabl':25B 'section':40B 'specif':7B 'sure':4B 'updat':33B 'usual':38B 'websit':27B 'week':11B	\N	complete	\N
ac3c3ad9-94db-4fd0-90d6-c2e7d8caa52e	66217e45-83d0-45a8-a43f-442bd54cd4be	\N	ai	### పిల్లల కవిత\n\nచిన్న చిన్న పక్షులు,  \nగాలిలో ఎగురుతాయి,  \nచెట్టు మీద కూర్చొని,  \nసంగీతం పాడుతాయి.\n\nపూలు పూస్తున్నాయి,  \nరంగులు అందంగా ఉన్నాయి,  \nచిన్న పిల్లలు నవ్వుతూ,  \nఆడుకుంటున్నారు సంతోషంగా.\n\nచెట్టు నీడలో కూర్చొని,  \nకథలు వినిపిస్తాయి,  \nస్నేహితులందరితో కలిసి,  \nఈ రోజు చాలా ఆనందంగా ఉంది!	### పిల్లల కవిత\n\nచిన్న చిన్న పక్షులు,  \nగాలిలో ఎగురుతాయి,  \nచెట్టు మీద కూర్చొని,  \nసంగీతం పాడుతాయి.\n\nపూలు పూస్తున్నాయి,  \nరంగులు అందంగా ఉన్నాయి,  \nచిన్న పిల్లలు నవ్వుతూ,  \nఆడుకుంటున్నారు సంతోషంగా.\n\nచెట్టు నీడలో కూర్చొని,  \nకథలు వినిపిస్తాయి,  \nస్నేహితులందరితో కలిసి,  \nఈ రోజు చాలా ఆనందంగా ఉంది!	{"prompt": "Kids Poem in Telugu", "source": "ai"}	2025-09-19 18:16:14.294116+05:30	2025-09-19 18:16:17.675719+05:30	'అందంగా':16B 'ఆడుకుంటున్నారు':21B 'ఆనందంగా':33B 'ఈ':30B 'ఉంది':34B 'ఉన్నాయి':17B 'ఎగురుతాయి':7B 'కథలు':26B 'కలిసి':29B 'కవిత':2B 'కూర్చొని':10B,25B 'గాలిలో':6B 'చాలా':32B 'చిన్న':3B,4B,18B 'చెట్టు':8B,23B 'నవ్వుతూ':20B 'నీడలో':24B 'పక్షులు':5B 'పాడుతాయి':12B 'పిల్లల':1B 'పిల్లలు':19B 'పూలు':13B 'పూస్తున్నాయి':14B 'మీద':9B 'రంగులు':15B 'రోజు':31B 'వినిపిస్తాయి':27B 'సంగీతం':11B 'సంతోషంగా':22B 'స్నేహితులందరితో':28B	\N	complete	\N
54c3fb1f-00c1-43f8-aeb3-2278058f619c	53ed30f6-7b66-42f4-8e35-482278885c77	\N	ai	The Empirical Rule, also known as the 68-95-99.7 rule, is a statistical guideline that applies to normal distributions. Here’s a simple breakdown:\n\n1. **68% of Data**: About 68% of the data points fall within one standard deviation (σ) of the mean (μ). This means if you have a normal distribution, most of your data will be close to the average.\n\n2. **95% of Data**: About 95% of the data points fall within two standard deviations of the mean. This indicates that a large majority of your data is still close to the average, but a bit more spread out.\n\n3. **99.7% of Data**: About 99.7% of the data points fall within three standard deviations of the mean. This shows that almost all data points are included within this range.\n\n### Example:\n- If the mean height of a group of people is 170 cm with a standard deviation of 10 cm:\n  - **68%** of people will be between 160 cm and 180 cm (170 ± 10).\n  - **95%** will be between 150 cm and 190 cm (170 ± 20).\n  - **99.7%** will be between 140 cm and 200 cm (170 ± 30).\n\nThe Empirical Rule helps in understanding the distribution of data and is useful in various fields, including data science, to make predictions and analyze data sets.	The Empirical Rule, also known as the 68-95-99.7 rule, is a statistical guideline that applies to normal distributions. Here’s a simple breakdown:\n\n1. **68% of Data**: About 68% of the data points fall within one standard deviation (σ) of the mean (μ). This means if you have a normal distribution, most of your data will be close to the average.\n\n2. **95% of Data**: About 95% of the data points fall within two standard deviations of the mean. This indicates that a large majority of your data is still close to the average, but a bit more spread out.\n\n3. **99.7% of Data**: About 99.7% of the data points fall within three standard deviations of the mean. This shows that almost all data points are included within this range.\n\n### Example:\n- If the mean height of a group of people is 170 cm with a standard deviation of 10 cm:\n  - **68%** of people will be between 160 cm and 180 cm (170 ± 10).\n  - **95%** will be between 150 cm and 190 cm (170 ± 20).\n  - **99.7%** will be between 140 cm and 200 cm (170 ± 30).\n\nThe Empirical Rule helps in understanding the distribution of data and is useful in various fields, including data science, to make predictions and analyze data sets.	{"prompt": "Empirical Rule of Data Science", "source": "ai"}	2025-09-21 11:06:34.601497+05:30	2025-09-21 11:06:40.578793+05:30	'-95':9B '-99.7':10B '1':25B '10':150B,165B '140':182B '150':170B '160':158B '170':143B,163B,175B,187B '180':161B '190':173B '2':63B '20':177B '200':185B '3':102B '30':189B '68':8B,26B,30B,152B '95':64B,68B,166B '99.7':103B,107B,178B 'almost':123B 'also':4B 'analyz':213B 'appli':17B 'averag':62B,95B 'bit':98B 'breakdown':24B 'close':59B,92B 'cm':144B,151B,159B,162B,171B,174B,183B,186B 'data':28B,33B,56B,66B,71B,89B,105B,110B,125B,199B,207B,214B 'deviat':39B,77B,116B,148B 'distribut':20B,52B,197B 'empir':2B,191B 'exampl':132B 'fall':35B,73B,112B 'field':205B 'group':139B 'guidelin':15B 'height':136B 'help':193B 'here’':21B 'includ':128B,206B 'indic':82B 'known':5B 'larg':85B 'major':86B 'make':210B 'mean':43B,46B,80B,119B,135B 'normal':19B,51B 'one':37B 'peopl':141B,154B 'point':34B,72B,111B,126B 'predict':211B 'rang':131B 'rule':3B,11B,192B 'scienc':208B 'set':215B 'show':121B 'simpl':23B 'spread':100B 'standard':38B,76B,115B,147B 'statist':14B 'still':91B 'three':114B 'two':75B 'understand':195B 'use':202B 'various':204B 'within':36B,74B,113B,129B '±':164B,176B,188B 'μ':44B 'σ':40B	\N	complete	\N
35a68686-6a53-4006-bd4e-925d9af29559	0c6158e8-972b-4f7a-be85-a0711ce0232a	\N	ai	### Sampling Distribution\n\nA sampling distribution is a probability distribution of a statistic obtained by selecting random samples from a population. Here are some key points:\n\n1. **Definition**: It shows how a statistic (like the mean or proportion) varies from sample to sample.\n\n2. **Central Limit Theorem**: This theorem states that, as the sample size increases, the sampling distribution of the sample mean will approach a normal distribution, regardless of the shape of the population distribution.\n\n3. **Standard Error**: The standard deviation of the sampling distribution is called the standard error. It measures how much the sample mean is expected to vary from the true population mean.\n\n4. **Importance**: Sampling distributions are important for making inferences about a population based on sample data. They help in estimating population parameters and testing hypotheses.\n\n5. **Types of Statistics**: You can create sampling distributions for various statistics, such as the sample mean, sample proportion, or sample variance.\n\n### Example\n\nIf you take multiple samples of size 30 from a population and calculate the mean for each sample, the distribution of those sample means will form a sampling distribution.\n\nIf you have more questions or need further explanation, feel free to ask!	### Sampling Distribution\n\nA sampling distribution is a probability distribution of a statistic obtained by selecting random samples from a population. Here are some key points:\n\n1. **Definition**: It shows how a statistic (like the mean or proportion) varies from sample to sample.\n\n2. **Central Limit Theorem**: This theorem states that, as the sample size increases, the sampling distribution of the sample mean will approach a normal distribution, regardless of the shape of the population distribution.\n\n3. **Standard Error**: The standard deviation of the sampling distribution is called the standard error. It measures how much the sample mean is expected to vary from the true population mean.\n\n4. **Importance**: Sampling distributions are important for making inferences about a population based on sample data. They help in estimating population parameters and testing hypotheses.\n\n5. **Types of Statistics**: You can create sampling distributions for various statistics, such as the sample mean, sample proportion, or sample variance.\n\n### Example\n\nIf you take multiple samples of size 30 from a population and calculate the mean for each sample, the distribution of those sample means will form a sampling distribution.\n\nIf you have more questions or need further explanation, feel free to ask!	{"prompt": "Sampling Distribution", "source": "ai"}	2025-09-21 11:22:59.120573+05:30	2025-09-21 11:23:03.674888+05:30	'1':26B '2':43B '3':76B '30':162B '4':107B '5':132B 'approach':64B 'ask':196B 'base':119B 'calcul':167B 'call':87B 'central':44B 'creat':138B 'data':122B 'definit':27B 'deviat':81B 'distribut':2B,5B,9B,58B,67B,75B,85B,110B,140B,174B,183B 'error':78B,90B 'estim':126B 'exampl':154B 'expect':99B 'explan':192B 'feel':193B 'form':180B 'free':194B 'help':124B 'hypothes':131B 'import':108B,112B 'increas':55B 'infer':115B 'key':24B 'like':33B 'limit':45B 'make':114B 'mean':35B,62B,97B,106B,148B,169B,178B 'measur':92B 'much':94B 'multipl':158B 'need':190B 'normal':66B 'obtain':13B 'paramet':128B 'point':25B 'popul':20B,74B,105B,118B,127B,165B 'probabl':8B 'proport':37B,150B 'question':188B 'random':16B 'regardless':68B 'sampl':1B,4B,17B,40B,42B,53B,57B,61B,84B,96B,109B,121B,139B,147B,149B,152B,159B,172B,177B,182B 'select':15B 'shape':71B 'show':29B 'size':54B,161B 'standard':77B,80B,89B 'state':49B 'statist':12B,32B,135B,143B 'take':157B 'test':130B 'theorem':46B,48B 'true':104B 'type':133B 'vari':38B,101B 'varianc':153B 'various':142B	\N	complete	\N
39ff51ad-da1b-4efd-b159-ce1839947eed	8209ee91-860e-4415-97b4-91f6f1e3b60d	\N	ai	Probability is a branch of mathematics that deals with the likelihood of different outcomes. It helps us understand how likely an event is to happen. Here are some key concepts:\n\n1. **Experiment**: An action or process that leads to one or more outcomes. For example, flipping a coin.\n\n2. **Outcome**: A possible result of an experiment. For example, getting heads or tails when flipping a coin.\n\n3. **Event**: A specific outcome or a group of outcomes. For example, getting an even number when rolling a die.\n\n4. **Probability of an Event**: This is calculated by dividing the number of favorable outcomes by the total number of possible outcomes. The formula is:\n   \\[\n   \\text{Probability} (P) = \\frac{\\text{Number of favorable outcomes}}{\\text{Total number of possible outcomes}}\n   \\]\n\n5. **Range**: Probability values range from 0 to 1. A probability of 0 means the event cannot happen, while a probability of 1 means the event will definitely happen.\n\n### Example:\nIf you roll a six-sided die, the probability of rolling a 4 is:\n- Favorable outcomes: 1 (only the number 4)\n- Total outcomes: 6 (1, 2, 3, 4, 5, 6)\n\nSo, the probability is:\n\\[\nP(4) = \\frac{1}{6}\n\\]\n\nIf you have any specific questions about probability, feel free to ask!	Probability is a branch of mathematics that deals with the likelihood of different outcomes. It helps us understand how likely an event is to happen. Here are some key concepts:\n\n1. **Experiment**: An action or process that leads to one or more outcomes. For example, flipping a coin.\n\n2. **Outcome**: A possible result of an experiment. For example, getting heads or tails when flipping a coin.\n\n3. **Event**: A specific outcome or a group of outcomes. For example, getting an even number when rolling a die.\n\n4. **Probability of an Event**: This is calculated by dividing the number of favorable outcomes by the total number of possible outcomes. The formula is:\n   \\[\n   \\text{Probability} (P) = \\frac{\\text{Number of favorable outcomes}}{\\text{Total number of possible outcomes}}\n   \\]\n\n5. **Range**: Probability values range from 0 to 1. A probability of 0 means the event cannot happen, while a probability of 1 means the event will definitely happen.\n\n### Example:\nIf you roll a six-sided die, the probability of rolling a 4 is:\n- Favorable outcomes: 1 (only the number 4)\n- Total outcomes: 6 (1, 2, 3, 4, 5, 6)\n\nSo, the probability is:\n\\[\nP(4) = \\frac{1}{6}\n\\]\n\nIf you have any specific questions about probability, feel free to ask!	{"prompt": "Probability", "source": "ai"}	2025-09-21 11:26:44.111125+05:30	2025-09-21 11:26:50.28659+05:30	'0':133B,139B '1':31B,135B,149B,174B,182B,195B '2':49B,183B '3':67B,184B '4':87B,170B,178B,185B,193B '5':127B,186B '6':181B,187B,196B 'action':34B 'ask':208B 'branch':4B 'calcul':94B 'cannot':143B 'coin':48B,66B 'concept':30B 'deal':8B 'definit':154B 'die':86B,164B 'differ':13B 'divid':96B 'even':81B 'event':22B,68B,91B,142B,152B 'exampl':45B,58B,78B,156B 'experi':32B,56B 'favor':100B,119B,172B 'feel':205B 'flip':46B,64B 'formula':110B 'frac':115B,194B 'free':206B 'get':59B,79B 'group':74B 'happen':25B,144B,155B 'head':60B 'help':16B 'key':29B 'lead':38B 'like':20B 'likelihood':11B 'mathemat':6B 'mean':140B,150B 'number':82B,98B,105B,117B,123B,177B 'one':40B 'outcom':14B,43B,50B,71B,76B,101B,108B,120B,126B,173B,180B 'p':114B,192B 'possibl':52B,107B,125B 'probabl':1B,88B,113B,129B,137B,147B,166B,190B,204B 'process':36B 'question':202B 'rang':128B,131B 'result':53B 'roll':84B,159B,168B 'side':163B 'six':162B 'six-sid':161B 'specif':70B,201B 'tail':62B 'text':112B,116B,121B 'total':104B,122B,179B 'understand':18B 'us':17B 'valu':130B	\N	complete	\N
ae32417c-9c5c-45bc-bfb0-ee586a1c7176	bc748858-c05b-4bb9-ab98-e67fd224eac0	\N	ai	Python comprehension is a concise way to create lists, dictionaries, or sets. It allows you to generate these collections in a single line of code. Here are the main types of comprehensions:\n\n### List Comprehension\nYou can create a list using a simple syntax. For example:\n\n```python\nsquares = [x**2 for x in range(10)]\n```\nThis creates a list of squares from 0 to 9.\n\n### Dictionary Comprehension\nYou can also create dictionaries. For example:\n\n```python\nsquared_dict = {x: x**2 for x in range(5)}\n```\nThis creates a dictionary where the keys are numbers from 0 to 4 and the values are their squares.\n\n### Set Comprehension\nSimilarly, you can create sets:\n\n```python\nunique_squares = {x**2 for x in range(-5, 6)}\n```\nThis creates a set of unique squares from -5 to 5.\n\n### Conditional Comprehension\nYou can add conditions to comprehensions. For example:\n\n```python\neven_squares = [x**2 for x in range(10) if x % 2 == 0]\n```\nThis creates a list of squares of even numbers from 0 to 9.\n\n### Summary\nComprehensions make your code shorter and often more readable. They are a powerful feature in Python for creating collections efficiently.	Python comprehension is a concise way to create lists, dictionaries, or sets. It allows you to generate these collections in a single line of code. Here are the main types of comprehensions:\n\n### List Comprehension\nYou can create a list using a simple syntax. For example:\n\n```python\nsquares = [x**2 for x in range(10)]\n```\nThis creates a list of squares from 0 to 9.\n\n### Dictionary Comprehension\nYou can also create dictionaries. For example:\n\n```python\nsquared_dict = {x: x**2 for x in range(5)}\n```\nThis creates a dictionary where the keys are numbers from 0 to 4 and the values are their squares.\n\n### Set Comprehension\nSimilarly, you can create sets:\n\n```python\nunique_squares = {x**2 for x in range(-5, 6)}\n```\nThis creates a set of unique squares from -5 to 5.\n\n### Conditional Comprehension\nYou can add conditions to comprehensions. For example:\n\n```python\neven_squares = [x**2 for x in range(10) if x % 2 == 0]\n```\nThis creates a list of squares of even numbers from 0 to 9.\n\n### Summary\nComprehensions make your code shorter and often more readable. They are a powerful feature in Python for creating collections efficiently.	{"prompt": "Python Comprehension", "source": "ai"}	2025-09-21 13:19:35.323931+05:30	2025-09-21 13:19:42.126652+05:30	'-5':120B,130B '0':62B,95B,156B,167B '10':54B,152B '2':49B,79B,115B,147B,155B '4':97B '5':84B,132B '6':121B '9':64B,169B 'add':137B 'allow':14B 'also':69B 'code':25B,174B 'collect':19B,189B 'comprehens':2B,32B,34B,66B,105B,134B,140B,171B 'concis':5B 'condit':133B,138B 'creat':8B,37B,56B,70B,86B,109B,123B,158B,188B 'dict':76B 'dictionari':10B,65B,71B,88B 'effici':190B 'even':144B,164B 'exampl':45B,73B,142B 'featur':184B 'generat':17B 'key':91B 'line':23B 'list':9B,33B,39B,58B,160B 'main':29B 'make':172B 'number':93B,165B 'often':177B 'power':183B 'python':1B,46B,74B,111B,143B,186B 'rang':53B,83B,119B,151B 'readabl':179B 'set':12B,104B,110B,125B 'shorter':175B 'similar':106B 'simpl':42B 'singl':22B 'squar':47B,60B,75B,103B,113B,128B,145B,162B 'summari':170B 'syntax':43B 'type':30B 'uniqu':112B,127B 'use':40B 'valu':100B 'way':6B 'x':48B,51B,77B,78B,81B,114B,117B,146B,149B,154B	\N	complete	\N
e455adf6-c843-436a-9068-2047899768d6	8e40f87f-59ff-470c-9703-889580f23e1c	\N	ai	Normal distribution is a type of probability distribution that is symmetric and bell-shaped. It is often called the Gaussian distribution. Here are some key points about normal distribution:\n\n1. **Shape**: The graph of a normal distribution is a bell curve. It is highest at the mean and tapers off equally on both sides.\n\n2. **Mean, Median, Mode**: In a normal distribution, the mean (average), median (middle value), and mode (most frequent value) are all the same.\n\n3. **Standard Deviation**: The spread of the distribution is determined by the standard deviation. A smaller standard deviation means the data points are closer to the mean, while a larger standard deviation means they are spread out over a wider range.\n\n4. **Empirical Rule**: About 68% of the data falls within one standard deviation of the mean, about 95% falls within two standard deviations, and about 99.7% falls within three standard deviations.\n\n5. **Applications**: Normal distribution is used in many fields, including statistics, finance, and natural and social sciences, to model real-world phenomena.\n\nIf you have specific questions about normal distribution or need more details, feel free to ask!	Normal distribution is a type of probability distribution that is symmetric and bell-shaped. It is often called the Gaussian distribution. Here are some key points about normal distribution:\n\n1. **Shape**: The graph of a normal distribution is a bell curve. It is highest at the mean and tapers off equally on both sides.\n\n2. **Mean, Median, Mode**: In a normal distribution, the mean (average), median (middle value), and mode (most frequent value) are all the same.\n\n3. **Standard Deviation**: The spread of the distribution is determined by the standard deviation. A smaller standard deviation means the data points are closer to the mean, while a larger standard deviation means they are spread out over a wider range.\n\n4. **Empirical Rule**: About 68% of the data falls within one standard deviation of the mean, about 95% falls within two standard deviations, and about 99.7% falls within three standard deviations.\n\n5. **Applications**: Normal distribution is used in many fields, including statistics, finance, and natural and social sciences, to model real-world phenomena.\n\nIf you have specific questions about normal distribution or need more details, feel free to ask!	{"prompt": "Normal Distribution", "source": "ai"}	2025-09-21 17:55:06.760887+05:30	2025-09-21 17:55:12.265741+05:30	'1':31B '2':56B '3':79B '4':120B '5':151B '68':124B '95':137B '99.7':145B 'applic':152B 'ask':189B 'averag':66B 'bell':14B,41B 'bell-shap':13B 'call':19B 'closer':102B 'curv':42B 'data':99B,127B 'detail':185B 'determin':88B 'deviat':81B,92B,96B,110B,132B,142B,150B 'distribut':2B,8B,22B,30B,38B,63B,86B,154B,181B 'empir':121B 'equal':52B 'fall':128B,138B,146B 'feel':186B 'field':159B 'financ':162B 'free':187B 'frequent':73B 'gaussian':21B 'graph':34B 'highest':45B 'includ':160B 'key':26B 'larger':108B 'mani':158B 'mean':48B,57B,65B,97B,105B,111B,135B 'median':58B,67B 'middl':68B 'mode':59B,71B 'model':169B 'natur':164B 'need':183B 'normal':1B,29B,37B,62B,153B,180B 'often':18B 'one':130B 'phenomena':173B 'point':27B,100B 'probabl':7B 'question':178B 'rang':119B 'real':171B 'real-world':170B 'rule':122B 'scienc':167B 'shape':15B,32B 'side':55B 'smaller':94B 'social':166B 'specif':177B 'spread':83B,114B 'standard':80B,91B,95B,109B,131B,141B,149B 'statist':161B 'symmetr':11B 'taper':50B 'three':148B 'two':140B 'type':5B 'use':156B 'valu':69B,74B 'wider':118B 'within':129B,139B,147B 'world':172B	\N	complete	\N
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: ink
--

COPY public.sessions (id, account_id, created_at, last_seen_at) FROM stdin;
04220b0f-efc0-4976-bdf7-edffcfe63c6e	268a0026-45cd-41d8-9458-4c7874b22ba6	2025-08-28 16:02:19.909442+05:30	2025-08-28 16:02:19.909442+05:30
875d7675-28e4-4419-b926-f7c05414b2d9	268a0026-45cd-41d8-9458-4c7874b22ba6	2025-08-29 09:47:48.986602+05:30	2025-08-29 09:47:48.986602+05:30
46d32ca7-f708-4747-9a40-13cda9e909a7	268a0026-45cd-41d8-9458-4c7874b22ba6	2025-08-29 10:05:15.98484+05:30	2025-08-29 10:05:15.98484+05:30
a036eefb-c33b-4f27-9e1a-d9abd09dd647	268a0026-45cd-41d8-9458-4c7874b22ba6	2025-08-29 15:13:17.303836+05:30	2025-08-29 15:13:17.303836+05:30
fac7271d-fe1d-4b45-bb71-1bf191316155	268a0026-45cd-41d8-9458-4c7874b22ba6	2025-08-30 17:07:45.918148+05:30	2025-08-30 17:07:45.918148+05:30
c622f0cc-529b-4b9e-bfd1-1e3ff421bc87	268a0026-45cd-41d8-9458-4c7874b22ba6	2025-08-31 07:51:25.881871+05:30	2025-08-31 07:51:25.881871+05:30
a8b437d9-13f0-46f5-848d-7136753652e9	268a0026-45cd-41d8-9458-4c7874b22ba6	2025-09-01 10:46:50.389864+05:30	2025-09-01 10:46:50.389864+05:30
d3d8f9f1-761a-459a-9e1e-09e437c7feb7	268a0026-45cd-41d8-9458-4c7874b22ba6	2025-09-01 11:00:00.69485+05:30	2025-09-01 11:00:00.69485+05:30
97c44661-9393-45ee-8190-25171abd6385	268a0026-45cd-41d8-9458-4c7874b22ba6	2025-09-01 11:44:14.527624+05:30	2025-09-01 11:44:14.527624+05:30
cd6f4013-4c83-4f35-aeaa-5c34e8bf4b35	29c27c16-89fa-4f73-941e-29c722ed7979	2025-09-02 22:46:24.000949+05:30	2025-09-02 22:46:24.000949+05:30
1a69e997-f506-4435-9747-a7492d624375	29c27c16-89fa-4f73-941e-29c722ed7979	2025-09-03 12:31:36.831621+05:30	2025-09-03 12:31:36.831621+05:30
11bfb818-fd33-4680-a8cf-0effcf0d9799	29c27c16-89fa-4f73-941e-29c722ed7979	2025-09-03 18:09:26.433587+05:30	2025-09-03 18:09:26.433587+05:30
9b736d21-7543-4f27-bb69-08e91463be0e	268a0026-45cd-41d8-9458-4c7874b22ba6	2025-09-15 16:44:39.398744+05:30	2025-09-15 16:44:39.398744+05:30
afc01d37-4ca1-41e9-bcfe-9c879c07d272	268a0026-45cd-41d8-9458-4c7874b22ba6	2025-09-15 17:09:11.431822+05:30	2025-09-15 17:09:11.431822+05:30
50e35dba-1af1-4665-85fd-bde666b1edbc	268a0026-45cd-41d8-9458-4c7874b22ba6	2025-09-15 17:13:43.474369+05:30	2025-09-15 17:13:43.474369+05:30
dfefce72-db80-4f45-8fe5-5d00bad4a349	268a0026-45cd-41d8-9458-4c7874b22ba6	2025-09-15 17:16:23.973285+05:30	2025-09-15 17:16:23.973285+05:30
9cfa0300-fd28-4d1a-b261-bacd3f770328	29c27c16-89fa-4f73-941e-29c722ed7979	2025-09-15 19:49:50.944224+05:30	2025-09-15 19:49:50.944224+05:30
3c78d163-e08f-4546-b780-a06a447c6c8e	29c27c16-89fa-4f73-941e-29c722ed7979	2025-09-15 21:12:18.356876+05:30	2025-09-15 21:12:18.356876+05:30
4252ad57-96a4-4870-a130-dc996233db76	268a0026-45cd-41d8-9458-4c7874b22ba6	2025-09-15 21:20:46.512488+05:30	2025-09-15 21:20:46.512488+05:30
4de7eefd-f32d-435a-84d2-36c5b184f80f	29c27c16-89fa-4f73-941e-29c722ed7979	2025-09-17 09:46:46.843381+05:30	2025-09-17 09:46:46.843381+05:30
b0f33072-43a3-4e8f-935d-8ad309ecc895	29c27c16-89fa-4f73-941e-29c722ed7979	2025-09-21 17:39:39.129349+05:30	2025-09-21 17:39:39.129349+05:30
\.


--
-- Data for Name: shelves; Type: TABLE DATA; Schema: public; Owner: ink
--

COPY public.shelves (user_id, book_isbn, book_title, book_authors, status, note, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: topics; Type: TABLE DATA; Schema: public; Owner: ink
--

COPY public.topics (id, user_id, title, description, canonical_response_id, tags, meta, created_at, updated_at, search_vector, embedding, embedding_json) FROM stdin;
45a2f64b-884b-40fc-9e17-235509720ece	29c27c16-89fa-4f73-941e-29c722ed7979	Linear Algebra review	Summarize eigenvalues and eigenvectors	\N	["math", "linear-algebra"]	{"visibility": "private"}	2025-09-17 10:13:31.41791+05:30	2025-09-17 10:13:31.41791+05:30	'algebra':2A 'eigenvalu':5B 'eigenvector':7B 'linear':1A 'review':3A 'summar':4B	\N	\N
392dc7c6-ba9c-443e-8435-90efcb19e763	29c27c16-89fa-4f73-941e-29c722ed7979	Linear Algebra Review	Summarize eigenvalues and eigenvectors	\N	["math"]	{"visibility": "private"}	2025-09-17 15:03:45.614234+05:30	2025-09-17 15:03:45.614234+05:30	'algebra':2A 'eigenvalu':5B 'eigenvector':7B 'linear':1A 'review':3A 'summar':4B	\N	\N
0dbc4491-d73c-4c60-9cdb-2f4d49734339	29c27c16-89fa-4f73-941e-29c722ed7979	Probability	Probability	\N	[]	{"visibility": "private"}	2025-09-18 12:05:41.027916+05:30	2025-09-18 12:05:41.027916+05:30	'probabl':1A,2B	\N	\N
bcee5cb4-cf41-4868-8134-d4f168f7321c	29c27c16-89fa-4f73-941e-29c722ed7979	Probability Theory	Probability Theory	\N	[]	{"visibility": "private"}	2025-09-18 16:28:33.110749+05:30	2025-09-18 16:28:33.110749+05:30	'probabl':1A,3B 'theori':2A,4B	\N	\N
eec16f54-06fb-4213-a11e-e27dbe05a62b	29c27c16-89fa-4f73-941e-29c722ed7979	Conditional Probability	Conditional Probability	\N	[]	{"visibility": "private"}	2025-09-18 17:23:37.065954+05:30	2025-09-18 17:23:37.065954+05:30	'condit':1A,3B 'probabl':2A,4B	\N	\N
3ab87c1a-4545-4296-b7b0-b0f30c03b0eb	29c27c16-89fa-4f73-941e-29c722ed7979	Basics of Python 	Basics of Python 	\N	[]	{"visibility": "private"}	2025-09-18 23:29:59.481811+05:30	2025-09-18 23:29:59.481811+05:30	'basic':1A,4B 'python':3A,6B	\N	\N
18064fbe-5a1a-4ac2-80f5-6e4a81afde4b	29c27c16-89fa-4f73-941e-29c722ed7979	Class one Addition	Class one Addition	\N	[]	{"visibility": "private"}	2025-09-18 23:52:11.72094+05:30	2025-09-18 23:52:11.72094+05:30	'addit':3A,6B 'class':1A,4B 'one':2A,5B	\N	\N
df2dc1da-9f1f-4cb3-8173-5155d13a5b8d	29c27c16-89fa-4f73-941e-29c722ed7979	Build me a reading and fill in the blanks exercise for class 2 kid	Build me a reading and fill in the blanks exercise for class 2 kid	\N	[]	{"visibility": "private"}	2025-09-18 23:54:27.64036+05:30	2025-09-18 23:54:27.64036+05:30	'2':13A,27B 'blank':9A,23B 'build':1A,15B 'class':12A,26B 'exercis':10A,24B 'fill':6A,20B 'kid':14A,28B 'read':4A,18B	\N	\N
73536fd2-dacf-4ac9-8966-4e8b2f1e7dca	29c27c16-89fa-4f73-941e-29c722ed7979	NCERT Class 2 Hindi - Sarangi - Summary and Exercise	NCERT Class 2 Hindi - Sarangi - Summary and Exercise	\N	[]	{"visibility": "private"}	2025-09-19 00:41:45.436959+05:30	2025-09-19 00:41:45.436959+05:30	'2':3A,11B 'class':2A,10B 'exercis':8A,16B 'hindi':4A,12B 'ncert':1A,9B 'sarangi':5A,13B 'summari':6A,14B	\N	\N
217dbafd-6eb6-47c7-9a73-68e615a52797	29c27c16-89fa-4f73-941e-29c722ed7979	NCERT Class 2: Anadmayi HIndi Kavita: Cheeta - Summary and Exercise	NCERT Class 2: Anadmayi HIndi Kavita: Cheeta - Summary and Exercise	\N	[]	{"visibility": "private"}	2025-09-19 07:15:42.622169+05:30	2025-09-19 07:15:42.622169+05:30	'2':3A,13B 'anadmayi':4A,14B 'cheeta':7A,17B 'class':2A,12B 'exercis':10A,20B 'hindi':5A,15B 'kavita':6A,16B 'ncert':1A,11B 'summari':8A,18B	\N	\N
83eb71fb-c711-4f74-8677-617e01758cc5	29c27c16-89fa-4f73-941e-29c722ed7979	NCERT Class 2 Hindi - Sarangi - Summary and Exercise	NCERT Class 2 Hindi - Sarangi - Summary and Exercise	\N	[]	{"visibility": "private"}	2025-09-19 07:16:47.613574+05:30	2025-09-19 07:16:47.613574+05:30	'2':3A,11B 'class':2A,10B 'exercis':8A,16B 'hindi':4A,12B 'ncert':1A,9B 'sarangi':5A,13B 'summari':6A,14B	\N	\N
6b5f8282-fdf5-4107-a203-9a50a0dd94a1	29c27c16-89fa-4f73-941e-29c722ed7979	NCERT Class 2 Hindi book - Sarangi - Summary and Exercise  of Chapter Mala ki chandi ki payal	NCERT Class 2 Hindi book - Sarangi - Summary and Exercise  of Chapter Mala ki chandi ki payal	\N	[]	{"visibility": "private"}	2025-09-19 07:22:42.626588+05:30	2025-09-19 07:22:42.626588+05:30	'2':3A,19B 'book':5A,21B 'chandi':14A,30B 'chapter':11A,27B 'class':2A,18B 'exercis':9A,25B 'hindi':4A,20B 'ki':13A,15A,29B,31B 'mala':12A,28B 'ncert':1A,17B 'payal':16A,32B 'sarangi':6A,22B 'summari':7A,23B	\N	\N
dbfd1914-ccd1-452c-88a7-79a0eb1667c2	29c27c16-89fa-4f73-941e-29c722ed7979	Give me a good Hindi Kavita for Class 2 Kid from NCERT Hindi Book.	Give me a good Hindi Kavita for Class 2 Kid from NCERT Hindi Book.	\N	[]	{"visibility": "private"}	2025-09-19 07:29:34.735399+05:30	2025-09-19 07:29:34.735399+05:30	'2':9A,23B 'book':14A,28B 'class':8A,22B 'give':1A,15B 'good':4A,18B 'hindi':5A,13A,19B,27B 'kavita':6A,20B 'kid':10A,24B 'ncert':12A,26B	\N	\N
4946eb64-4adb-40aa-aa42-19fa5d992173	29c27c16-89fa-4f73-941e-29c722ed7979	NCERT Class 2 Hindi book - Story Sarangi - Summary and Exercise in hindi	NCERT Class 2 Hindi book - Story Sarangi - Summary and Exercise in hindi	\N	[]	{"visibility": "private"}	2025-09-19 07:36:16.7106+05:30	2025-09-19 07:36:16.7106+05:30	'2':3A,15B 'book':5A,17B 'class':2A,14B 'exercis':10A,22B 'hindi':4A,12A,16B,24B 'ncert':1A,13B 'sarangi':7A,19B 'stori':6A,18B 'summari':8A,20B	\N	\N
364f0430-f341-4db1-ab17-c0e4f1a4ae3e	29c27c16-89fa-4f73-941e-29c722ed7979	NCERT - Class 6 - Deepkam Sanskrit Book - Summary and Exercise for Chapter - Atithi Devobhava In Sanskrit	NCERT - Class 6 - Deepkam Sanskrit Book - Summary and Exercise for Chapter - Atithi Devobhava In Sanskrit	\N	[]	{"visibility": "private"}	2025-09-19 07:44:31.332172+05:30	2025-09-19 07:44:31.332172+05:30	'6':3A,18B 'atithi':12A,27B 'book':6A,21B 'chapter':11A,26B 'class':2A,17B 'deepkam':4A,19B 'devobhava':13A,28B 'exercis':9A,24B 'ncert':1A,16B 'sanskrit':5A,15A,20B,30B 'summari':7A,22B	\N	\N
7c6fc3d8-ebc7-47b0-8ec7-479bd16d65f8	29c27c16-89fa-4f73-941e-29c722ed7979	NCERT - Class 6 - Deepkam Sanskrit Book - Summary and Exercise for Chapter - Atithi Devobhava In Sanskrit	NCERT - Class 6 - Deepkam Sanskrit Book - Summary and Exercise for Chapter - Atithi Devobhava In Sanskrit	\N	[]	{"visibility": "private"}	2025-09-19 07:51:30.238113+05:30	2025-09-19 07:51:30.238113+05:30	'6':3A,18B 'atithi':12A,27B 'book':6A,21B 'chapter':11A,26B 'class':2A,17B 'deepkam':4A,19B 'devobhava':13A,28B 'exercis':9A,24B 'ncert':1A,16B 'sanskrit':5A,15A,20B,30B 'summari':7A,22B	\N	\N
63b8c00e-63ab-42b5-8a53-a8ce5f2a1616	29c27c16-89fa-4f73-941e-29c722ed7979	Give me few Sanskrit shlokas in Sanskrit language	Give me few Sanskrit shlokas in Sanskrit language	\N	[]	{"visibility": "private"}	2025-09-19 07:57:39.423387+05:30	2025-09-19 07:57:39.423387+05:30	'give':1A,9B 'languag':8A,16B 'sanskrit':4A,7A,12B,15B 'shloka':5A,13B	\N	\N
327ab1c4-1d61-44c3-9dd1-331de1f7fe71	29c27c16-89fa-4f73-941e-29c722ed7979	give me an exercise for spell for class 2	give me an exercise for spell for class 2	\N	[]	{"visibility": "private"}	2025-09-19 09:26:18.219047+05:30	2025-09-19 09:26:18.219047+05:30	'2':9A,18B 'class':8A,17B 'exercis':4A,13B 'give':1A,10B 'spell':6A,15B	\N	\N
3af16f18-0fd4-40ee-8eea-51db617091fb	29c27c16-89fa-4f73-941e-29c722ed7979	current affairs on last week news	current affairs on last week news	\N	[]	{"visibility": "private"}	2025-09-19 09:28:49.491433+05:30	2025-09-19 09:28:49.491433+05:30	'affair':2A,8B 'current':1A,7B 'last':4A,10B 'news':6A,12B 'week':5A,11B	\N	\N
66217e45-83d0-45a8-a43f-442bd54cd4be	29c27c16-89fa-4f73-941e-29c722ed7979	Kids Poem in Telugu	Kids Poem in Telugu	\N	[]	{"visibility": "private"}	2025-09-19 18:16:14.268881+05:30	2025-09-19 18:16:14.268881+05:30	'kid':1A,5B 'poem':2A,6B 'telugu':4A,8B	\N	\N
53ed30f6-7b66-42f4-8e35-482278885c77	29c27c16-89fa-4f73-941e-29c722ed7979	Empirical Rule of Data Science	Empirical Rule of Data Science	\N	[]	{"visibility": "private"}	2025-09-21 11:06:34.568755+05:30	2025-09-21 11:06:34.568755+05:30	'data':4A,9B 'empir':1A,6B 'rule':2A,7B 'scienc':5A,10B	\N	\N
0c6158e8-972b-4f7a-be85-a0711ce0232a	29c27c16-89fa-4f73-941e-29c722ed7979	Sampling Distribution	Sampling Distribution	\N	[]	{"visibility": "private"}	2025-09-21 11:22:59.117789+05:30	2025-09-21 11:22:59.117789+05:30	'distribut':2A,4B 'sampl':1A,3B	\N	\N
8209ee91-860e-4415-97b4-91f6f1e3b60d	29c27c16-89fa-4f73-941e-29c722ed7979	Probability	Probability	\N	[]	{"visibility": "private"}	2025-09-21 11:26:44.106903+05:30	2025-09-21 11:26:44.106903+05:30	'probabl':1A,2B	\N	\N
bc748858-c05b-4bb9-ab98-e67fd224eac0	29c27c16-89fa-4f73-941e-29c722ed7979	Python Comprehension	Python Comprehension	\N	[]	{"visibility": "private"}	2025-09-21 13:19:35.299134+05:30	2025-09-21 13:19:35.299134+05:30	'comprehens':2A,4B 'python':1A,3B	\N	\N
8e40f87f-59ff-470c-9703-889580f23e1c	29c27c16-89fa-4f73-941e-29c722ed7979	Normal Distribution	Normal Distribution	\N	[]	{"visibility": "private"}	2025-09-21 17:55:06.737389+05:30	2025-09-21 17:55:06.737389+05:30	'distribut':2A,4B 'normal':1A,3B	\N	\N
\.


--
-- Data for Name: user_counts; Type: TABLE DATA; Schema: public; Owner: ink
--

COPY public.user_counts (did, followers, following, posts, updated_at) FROM stdin;
\.


--
-- Data for Name: user_prefs; Type: TABLE DATA; Schema: public; Owner: ink
--

COPY public.user_prefs (user_id, default_feed, created_at, updated_at) FROM stdin;
268a0026-45cd-41d8-9458-4c7874b22ba6	user	2025-08-29 15:14:52.367479+05:30	2025-08-29 15:14:52.367479+05:30
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: ink
--

COPY public.users (did, handle, display_name, bio, avatar_url, banner_url, indexed_at, updated_at, id) FROM stdin;
did:plc:km2nrwo7d6p3x3j5z5mmg6jl	praveen-mishra.bsky.social		\N		\N	2025-09-15 21:12:18.348187+05:30	2025-09-15 21:12:18.348187+05:30	12b74165-0b26-414e-a956-aff1a4dfe856
did:plc:matwoj635dvtorkqxgzw7sti	inkreaders.com		\N		\N	2025-09-15 21:20:46.510411+05:30	2025-09-15 21:20:46.510411+05:30	e2bd74d1-ade9-4692-8b6b-0d9e60b62a89
\.


--
-- Name: books_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ink
--

SELECT pg_catalog.setval('public.books_id_seq', 33273, true);


--
-- Name: jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ink
--

SELECT pg_catalog.setval('public.jobs_id_seq', 1, false);


--
-- Name: accounts accounts_did_key; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_did_key UNIQUE (did);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: bookmarks bookmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_pkey PRIMARY KEY (user_id, post_uri);


--
-- Name: books books_isbn13_key; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.books
    ADD CONSTRAINT books_isbn13_key UNIQUE (isbn13);


--
-- Name: books books_pkey; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.books
    ADD CONSTRAINT books_pkey PRIMARY KEY (id);


--
-- Name: cursors cursors_pkey; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.cursors
    ADD CONSTRAINT cursors_pkey PRIMARY KEY (name);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: exercise_attempts exercise_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.exercise_attempts
    ADD CONSTRAINT exercise_attempts_pkey PRIMARY KEY (id);


--
-- Name: exercise_sets exercise_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.exercise_sets
    ADD CONSTRAINT exercise_sets_pkey PRIMARY KEY (id);


--
-- Name: exercises exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_pkey PRIMARY KEY (id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: follows follows_pkey; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_pkey PRIMARY KEY (src_did, dst_did);


--
-- Name: highlights highlights_pkey; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.highlights
    ADD CONSTRAINT highlights_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (uri);


--
-- Name: response_versions response_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.response_versions
    ADD CONSTRAINT response_versions_pkey PRIMARY KEY (id);


--
-- Name: responses responses_pkey; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: shelves shelves_pkey; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.shelves
    ADD CONSTRAINT shelves_pkey PRIMARY KEY (user_id, book_title);


--
-- Name: topics topics_pkey; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_pkey PRIMARY KEY (id);


--
-- Name: user_counts user_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.user_counts
    ADD CONSTRAINT user_counts_pkey PRIMARY KEY (did);


--
-- Name: user_prefs user_prefs_pkey; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.user_prefs
    ADD CONSTRAINT user_prefs_pkey PRIMARY KEY (user_id);


--
-- Name: users users_handle_key; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_handle_key UNIQUE (handle);


--
-- Name: users users_id_key; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_key UNIQUE (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (did);


--
-- Name: exercise_sets_questions_gin; Type: INDEX; Schema: public; Owner: ink
--

CREATE INDEX exercise_sets_questions_gin ON public.exercise_sets USING gin (questions jsonb_path_ops);


--
-- Name: exercise_sets_user_created_at_idx; Type: INDEX; Schema: public; Owner: ink
--

CREATE INDEX exercise_sets_user_created_at_idx ON public.exercise_sets USING btree (user_id, created_at DESC);


--
-- Name: exercise_sets_visibility_idx; Type: INDEX; Schema: public; Owner: ink
--

CREATE INDEX exercise_sets_visibility_idx ON public.exercise_sets USING btree (visibility);


--
-- Name: idx_jobs_jobtype_state; Type: INDEX; Schema: public; Owner: ink
--

CREATE INDEX idx_jobs_jobtype_state ON public.jobs USING btree (job_type, state);


--
-- Name: idx_jobs_state_runat; Type: INDEX; Schema: public; Owner: ink
--

CREATE INDEX idx_jobs_state_runat ON public.jobs USING btree (state, run_at);


--
-- Name: idx_responses_embedding_ivf; Type: INDEX; Schema: public; Owner: ink
--

CREATE INDEX idx_responses_embedding_ivf ON public.responses USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');


--
-- Name: idx_responses_search_gin; Type: INDEX; Schema: public; Owner: ink
--

CREATE INDEX idx_responses_search_gin ON public.responses USING gin (search_vector);


--
-- Name: idx_responses_topic_created_at; Type: INDEX; Schema: public; Owner: ink
--

CREATE INDEX idx_responses_topic_created_at ON public.responses USING btree (topic_id, created_at DESC);


--
-- Name: idx_topics_embedding_ivf; Type: INDEX; Schema: public; Owner: ink
--

CREATE INDEX idx_topics_embedding_ivf ON public.topics USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');


--
-- Name: idx_topics_search_gin; Type: INDEX; Schema: public; Owner: ink
--

CREATE INDEX idx_topics_search_gin ON public.topics USING gin (search_vector);


--
-- Name: idx_users_id; Type: INDEX; Schema: public; Owner: ink
--

CREATE INDEX idx_users_id ON public.users USING btree (id);


--
-- Name: sessions_account_idx; Type: INDEX; Schema: public; Owner: ink
--

CREATE INDEX sessions_account_idx ON public.sessions USING btree (account_id);


--
-- Name: users_handle_idx; Type: INDEX; Schema: public; Owner: ink
--

CREATE INDEX users_handle_idx ON public.users USING btree (handle);


--
-- Name: responses trg_create_response_version; Type: TRIGGER; Schema: public; Owner: ink
--

CREATE TRIGGER trg_create_response_version BEFORE UPDATE ON public.responses FOR EACH ROW EXECUTE FUNCTION public.create_response_version_trigger();


--
-- Name: responses trg_responses_search_vector; Type: TRIGGER; Schema: public; Owner: ink
--

CREATE TRIGGER trg_responses_search_vector BEFORE INSERT OR UPDATE ON public.responses FOR EACH ROW EXECUTE FUNCTION public.update_responses_search_vector();


--
-- Name: topics trg_topics_search_vector; Type: TRIGGER; Schema: public; Owner: ink
--

CREATE TRIGGER trg_topics_search_vector BEFORE INSERT OR UPDATE ON public.topics FOR EACH ROW EXECUTE FUNCTION public.update_topics_search_vector();


--
-- Name: jobs trg_touch_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: ink
--

CREATE TRIGGER trg_touch_jobs_updated_at BEFORE INSERT OR UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: exercise_attempts exercise_attempts_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.exercise_attempts
    ADD CONSTRAINT exercise_attempts_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE CASCADE;


--
-- Name: exercise_attempts exercise_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.exercise_attempts
    ADD CONSTRAINT exercise_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: exercise_sets exercise_sets_parent_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.exercise_sets
    ADD CONSTRAINT exercise_sets_parent_set_id_fkey FOREIGN KEY (parent_set_id) REFERENCES public.exercise_sets(id);


--
-- Name: exercise_sets exercise_sets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.exercise_sets
    ADD CONSTRAINT exercise_sets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: exercises exercises_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: files files_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: highlights highlights_response_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.highlights
    ADD CONSTRAINT highlights_response_id_fkey FOREIGN KEY (response_id) REFERENCES public.responses(id) ON DELETE CASCADE;


--
-- Name: highlights highlights_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.highlights
    ADD CONSTRAINT highlights_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE CASCADE;


--
-- Name: highlights highlights_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.highlights
    ADD CONSTRAINT highlights_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: posts posts_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id);


--
-- Name: response_versions response_versions_response_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.response_versions
    ADD CONSTRAINT response_versions_response_id_fkey FOREIGN KEY (response_id) REFERENCES public.responses(id) ON DELETE CASCADE;


--
-- Name: responses responses_parent_response_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_parent_response_id_fkey FOREIGN KEY (parent_response_id) REFERENCES public.responses(id);


--
-- Name: responses responses_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: topics topics_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_account_id_fkey FOREIGN KEY (user_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: topics topics_canonical_response_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_canonical_response_id_fkey FOREIGN KEY (canonical_response_id) REFERENCES public.responses(id) ON DELETE SET NULL;


--
-- Name: topics topics_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: user_prefs user_prefs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ink
--

ALTER TABLE ONLY public.user_prefs
    ADD CONSTRAINT user_prefs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 8maGhGbN1gFQRZ70bdWFTJb9PDqwkIPzWK1AaS2pHP11yh7DeGK0jvvDx8tu0N5

