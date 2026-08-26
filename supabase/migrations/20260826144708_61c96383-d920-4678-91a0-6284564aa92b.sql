-- 1. Administrative divisions (ЕКАТТЕ: области, общини, квартали)
CREATE TABLE public.regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.regions TO anon, authenticated;
GRANT ALL ON public.regions TO service_role;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Regions are public reference data" ON public.regions FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.municipalities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id uuid NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  has_neighborhoods boolean NOT NULL DEFAULT false,
  lat numeric,
  lng numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX municipalities_region_id_idx ON public.municipalities(region_id);
CREATE INDEX municipalities_name_idx ON public.municipalities(name);
GRANT SELECT ON public.municipalities TO anon, authenticated;
GRANT ALL ON public.municipalities TO service_role;
ALTER TABLE public.municipalities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Municipalities are public reference data" ON public.municipalities FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.neighborhoods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (municipality_id, name)
);
CREATE INDEX neighborhoods_municipality_id_idx ON public.neighborhoods(municipality_id);
GRANT SELECT ON public.neighborhoods TO anon, authenticated;
GRANT ALL ON public.neighborhoods TO service_role;
ALTER TABLE public.neighborhoods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Neighborhoods are public reference data" ON public.neighborhoods FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.regions (name, slug) SELECT split_part(v,'|',1), split_part(v,'|',2) FROM regexp_split_to_table($seed$Благоевград|blagoevgrad;Бургас|burgas;Варна|varna;Велико Търново|veliko-tarnovo;Видин|vidin;Враца|vratsa;Габрово|gabrovo;Добрич|dobrich;Кърджали|kardzhali;Кюстендил|kyustendil;Ловеч|lovech;Монтана|montana;Пазарджик|pazardzhik;Перник|pernik;Плевен|pleven;Пловдив|plovdiv;Разград|razgrad;Русе|ruse;Силистра|silistra;Сливен|sliven;Смолян|smolyan;София (столица)|sofiya;София област|sofiya-oblast;Стара Загора|stara-zagora;Търговище|targovishte;Хасково|haskovo;Шумен|shumen;Ямбол|yambol$seed$, ';') AS v;

INSERT INTO public.municipalities (region_id, name, slug, has_neighborhoods, lat, lng)
SELECT r.id, split_part(v,'|',2), split_part(v,'|',3), split_part(v,'|',4)='1', split_part(v,'|',5)::numeric, split_part(v,'|',6)::numeric
FROM regexp_split_to_table($seed$blagoevgrad|Банско|bansko|0|41.84042|23.48565;blagoevgrad|Белица|belitsa|0|41.95077|23.55922;blagoevgrad|Благоевград|blagoevgrad|1|42.02086|23.09434;blagoevgrad|Гоце Делчев|gotse-delchev|0|41.57282|23.72827;blagoevgrad|Гърмен|garmen|0|41.62555|23.82067;blagoevgrad|Кресна|kresna|0|41.72048|23.16644;blagoevgrad|Петрич|petrich|0|41.39811|23.20669;blagoevgrad|Разлог|razlog|0|41.886|23.46284;blagoevgrad|Сандански|sandanski|0|41.56784|23.28035;blagoevgrad|Сатовча|satovcha|0|41.56689|24.0046;blagoevgrad|Симитли|simitli|0|41.8897|23.106;blagoevgrad|Струмяни|strumyani|0|41.61596|23.10894;blagoevgrad|Хаджидимово|hadzhidimovo|0|41.5166|23.853;blagoevgrad|Якоруда|yakoruda|0|42.01781|23.66884;burgas|Айтос|aytos|0|42.70312|27.25064;burgas|Бургас|burgas|1|42.50479|27.46264;burgas|Камено|kameno|0|42.57355|27.29504;burgas|Карнобат|karnobat|0|42.65111|26.98035;burgas|Малко Търново|malko-tarnovo|0|41.97979|27.52505;burgas|Несебър|nesebar|0|42.6601|27.7206;burgas|Поморие|pomorie|0|42.56805|27.61557;burgas|Приморско|primorsko|0|42.26837|27.75329;burgas|Руен|ruen|0|42.86384|27.2561;burgas|Созопол|sozopol|0|42.41726|27.69618;burgas|Средец|sredets|0|42.34519|27.18125;burgas|Сунгурларе|sungurlare|0|42.76311|26.77346;burgas|Царево|tsarevo|0|42.16955|27.84541;varna|Аврен|avren|0|43.08533|27.71355;varna|Аксаково|aksakovo|0|43.3215|27.8227;varna|Белослав|beloslav|0|43.18711|27.70417;varna|Бяла|byala-varna|0|42.8799|27.88112;varna|Варна|varna|1|43.20466|27.91054;varna|Ветрино|vetrino|0|43.32333|27.39864;varna|Вълчи дол|valchi-dol|0|43.40553|27.55119;varna|Девня|devnya|0|43.2197|27.5584;varna|Долни чифлик|dolni-chiflik|0|42.9937|27.717;varna|Дългопол|dalgopol|0|43.04966|27.34639;varna|Провадия|provadiya|0|43.17703|27.44057;varna|Суворово|suvorovo|0|43.33155|27.59122;veliko-tarnovo|Велико Търново|veliko-tarnovo|1|43.0757|25.6172;veliko-tarnovo|Горна Оряховица|gorna-oryahovitsa|0|43.1208|25.68968;veliko-tarnovo|Елена|elena|0|42.92923|25.87482;veliko-tarnovo|Златарица|zlataritsa|0|43.04956|25.89267;veliko-tarnovo|Лясковец|lyaskovets|0|43.10814|25.71972;veliko-tarnovo|Павликени|pavlikeni|0|43.23873|25.30659;veliko-tarnovo|Полски Тръмбеш|polski-trambesh|0|43.371|25.6329;veliko-tarnovo|Свищов|svishtov|0|43.6184|25.3506;veliko-tarnovo|Стражица|strazhitsa|0|43.2306|25.967;veliko-tarnovo|Сухиндол|suhindol|0|43.18436|25.16429;vidin|Белоградчик|belogradchik|0|43.6278|22.683;vidin|Бойница|boynitsa|0|43.99578|22.5028;vidin|Брегово|bregovo|0|44.14843|22.64201;vidin|Видин|vidin|0|43.9962|22.8679;vidin|Грамада|gramada|0|43.8326|22.6606;vidin|Димово|dimovo|0|43.7417|22.7269;vidin|Кула|kula|0|43.8878|22.5214;vidin|Макреш|makresh|0|43.76897|22.55423;vidin|Ново село|novo-selo|0|44.11905|22.83941;vidin|Ружинци|ruzhintsi|0|43.63692|22.90909;vidin|Чупрене|chuprene|0|43.53022|22.72185;vratsa|Борован|borovan|0|43.46214|23.75669;vratsa|Бяла Слатина|byala-slatina|0|43.4688|23.9366;vratsa|Враца|vratsa|0|43.21024|23.55288;vratsa|Козлодуй|kozloduy|0|43.77556|23.72462;vratsa|Криводол|krivodol|0|43.36826|23.47511;vratsa|Мездра|mezdra|0|43.14621|23.71434;vratsa|Мизия|miziya|0|43.69124|23.8534;vratsa|Оряхово|oryahovo|0|43.73224|23.96073;vratsa|Роман|roman|0|43.1456|23.92537;vratsa|Хайредин|hayredin|0|43.56866|23.67847;gabrovo|Габрово|gabrovo|0|42.87422|25.31868;gabrovo|Дряново|dryanovo|0|42.9775|25.4782;gabrovo|Севлиево|sevlievo|0|43.02669|25.1034;gabrovo|Трявна|tryavna|0|42.87665|25.49884;dobrich|Балчик|balchik|0|43.4269|28.16172;dobrich|Генерал Тошево|general-toshevo|0|43.70168|28.03964;dobrich|Добрич|dobrich|1|43.5726|27.8273;dobrich|Добричка|dobrichka|0|43.57|27.83;dobrich|Каварна|kavarna|0|43.43551|28.33935;dobrich|Крушари|krushari|0|43.86486|27.73242;dobrich|Тервел|tervel|0|43.74884|27.40718;dobrich|Шабла|shabla|0|43.53794|28.53523;kardzhali|Ардино|ardino|0|41.58339|25.13368;kardzhali|Джебел|dzhebel|0|41.49632|25.30424;kardzhali|Кирково|kirkovo|0|41.36887|25.34193;kardzhali|Крумовград|krumovgrad|0|41.47129|25.65531;kardzhali|Кърджали|kardzhali|0|41.6338|25.3777;kardzhali|Момчилград|momchilgrad|0|41.52728|25.40939;kardzhali|Черноочене|chernoochene|0|41.76772|25.28094;kyustendil|Бобовдол|bobovdol|0|42.36639|23.00519;kyustendil|Бобошево|boboshevo|0|42.15097|22.9995;kyustendil|Дупница|dupnitsa|0|42.26133|23.11244;kyustendil|Кочериново|kocherinovo|0|42.08459|23.05579;kyustendil|Кюстендил|kyustendil|0|42.28688|22.69393;kyustendil|Невестино|nevestino|0|42.17534|22.81477;kyustendil|Рила|rila|0|42.12665|23.1321;kyustendil|Сапарева баня|sapareva-banya|0|42.28997|23.26863;kyustendil|Трекляно|treklyano|0|42.54041|22.56367;lovech|Априлци|apriltsi|0|42.8405|24.91949;lovech|Летница|letnitsa|0|43.30668|25.06125;lovech|Ловеч|lovech|0|43.137|24.7142;lovech|Луковит|lukovit|0|43.20784|24.16299;lovech|Тетевен|teteven|0|42.91869|24.25889;lovech|Троян|troyan|0|42.89037|24.71297;lovech|Угърчин|ugarchin|0|43.10623|24.41269;lovech|Ябланица|yablanitsa|0|43.03235|24.09919;montana|Берковица|berkovitsa|0|43.237|23.1251;montana|Бойчиновци|boychinovtsi|0|43.4715|23.3327;montana|Брусарци|brusartsi|0|43.6628|23.0666;montana|Вълчедръм|valchedram|0|43.69497|23.4427;montana|Вършец|varshets|0|43.19388|23.28658;montana|Георги Дамяново|georgi-damyanovo|0|43.3631|23.00558;montana|Лом|lom|0|43.81784|23.23833;montana|Медковец|medkovets|0|43.65648|23.19837;montana|Монтана|montana|0|43.40852|23.22573;montana|Чипровци|chiprovtsi|0|43.38444|22.88207;montana|Якимово|yakimovo|0|43.63723|23.30043;pazardzhik|Батак|batak|0|41.94418|24.21897;pazardzhik|Белово|belovo|0|42.21475|24.01808;pazardzhik|Брацигово|bratsigovo|0|42.0249|24.3708;pazardzhik|Велинград|velingrad|0|42.02754|23.99155;pazardzhik|Лесичово|lesichovo|0|42.32959|24.16279;pazardzhik|Пазарджик|pazardzhik|0|42.19277|24.33357;pazardzhik|Панагюрище|panagyurishte|0|42.50079|24.18596;pazardzhik|Пещера|peshtera|0|42.02989|24.29873;pazardzhik|Ракитово|rakitovo|0|41.98949|24.08748;pazardzhik|Септември|septemvri|0|42.2166|24.125;pazardzhik|Стрелча|strelcha|0|42.50605|24.32099;pazardzhik|Сърница|sarnitsa|0|41.72|24.05;pernik|Брезник|breznik|0|42.7413|22.9081;pernik|Земен|zemen|0|42.47794|22.74713;pernik|Ковачевци|kovachevtsi|0|42.54401|22.82509;pernik|Перник|pernik|1|42.60519|23.03784;pernik|Радомир|radomir|0|42.54426|22.96158;pernik|Трън|tran|0|42.8343|22.6504;pleven|Белене|belene|0|43.64451|25.12464;pleven|Гулянци|gulyantsi|0|43.64357|24.6955;pleven|Долна Митрополия|dolna-mitropoliya|0|43.4667|24.5333;pleven|Долни Дъбник|dolni-dabnik|0|43.40884|24.44232;pleven|Искър|iskar|0|43.45505|24.26748;pleven|Кнежа|knezha|0|43.4928|24.08076;pleven|Левски|levski|0|43.36145|25.1431;pleven|Никопол|nikopol|0|43.70086|24.89466;pleven|Плевен|pleven|1|43.417|24.6067;pleven|Пордим|pordim|0|43.37798|24.84764;pleven|Червен бряг|cherven-bryag|0|43.28045|24.08285;plovdiv|Асеновград|asenovgrad|0|42.00859|24.87758;plovdiv|Брезово|brezovo|0|42.3467|25.076;plovdiv|Калояново|kaloyanovo|0|42.39668|24.79434;plovdiv|Карлово|karlovo|0|42.64132|24.80594;plovdiv|Кричим|krichim|0|42.04263|24.46697;plovdiv|Куклен|kuklen|0|42.03|24.79;plovdiv|Лъки|laki|0|41.83299|24.83143;plovdiv|Марица|maritsa|0|42.21653|24.77766;plovdiv|Перущица|perushtitsa|0|42.05752|24.54795;plovdiv|Пловдив|plovdiv|1|42.1354|24.7453;plovdiv|Първомай|parvomay|0|42.09691|25.22046;plovdiv|Раковски|rakovski|0|42.27158|24.9431;plovdiv|Родопи|rodopi|0|42.0429|24.67784;plovdiv|Садово|sadovo|0|42.1309|24.9395;plovdiv|Сопот|sopot|0|42.65|24.75;plovdiv|Стамболийски|stamboliyski|0|42.13331|24.53767;plovdiv|Съединение|saedinenie|0|42.27469|24.54656;plovdiv|Хисаря|hisarya|0|42.50437|24.70621;razgrad|Завет|zavet|0|43.76335|26.67898;razgrad|Исперих|isperih|0|43.71621|26.83072;razgrad|Кубрат|kubrat|0|43.79614|26.50053;razgrad|Лозница|loznitsa|0|43.37183|26.60803;razgrad|Разград|razgrad|0|43.5333|26.5167;razgrad|Самуил|samuil|0|43.56532|26.7995;razgrad|Цар Калоян|tsar-kaloyan|0|43.60865|26.23693;ruse|Борово|borovo|0|43.48421|25.80558;ruse|Бяла|byala-ruse|0|43.45996|25.73915;ruse|Ветово|vetovo|0|43.70329|26.26385;ruse|Две могили|dve-mogili|0|43.59175|25.87066;ruse|Иваново|ivanovo|0|43.66299|25.98696;ruse|Русе|ruse|1|43.83557|25.96566;ruse|Сливо поле|slivo-pole|0|43.93753|26.28729;ruse|Ценово|tsenovo|0|43.57095|25.61027;silistra|Алфатар|alfatar|0|43.94585|27.28657;silistra|Главиница|glavinitsa|0|43.91118|26.83434;silistra|Дулово|dulovo|0|43.82224|27.1397;silistra|Кайнарджа|kaynardzha|0|43.93609|27.5052;silistra|Силистра|silistra|0|44.1147|27.2672;silistra|Ситово|sitovo|0|44.00776|26.99063;silistra|Тутракан|tutrakan|0|44.0386|26.61951;sliven|Котел|kotel|0|42.88677|26.44965;sliven|Нова Загора|nova-zagora|0|42.4936|26.0085;sliven|Сливен|sliven|1|42.68165|26.32287;sliven|Твърдица|tvarditsa|0|42.70156|25.89604;smolyan|Баните|banite|0|41.66853|24.99827;smolyan|Борино|borino|0|41.61048|24.32028;smolyan|Девин|devin|0|41.74291|24.39154;smolyan|Доспат|dospat|0|41.64597|24.15952;smolyan|Златоград|zlatograd|0|41.37985|25.09652;smolyan|Мадан|madan|0|41.49858|24.93993;smolyan|Неделино|nedelino|0|41.45639|25.0788;smolyan|Рудозем|rudozem|0|41.48705|24.84779;smolyan|Смолян|smolyan|0|41.5774|24.7011;smolyan|Чепеларе|chepelare|0|41.72476|24.68562;sofiya|София|sofiya|1|42.70836|23.36505;sofiya-oblast|Антон|anton|0|42.73529|24.25952;sofiya-oblast|Божурище|bozhurishte|0|42.7635|23.202;sofiya-oblast|Ботевград|botevgrad|0|42.90765|23.79337;sofiya-oblast|Годеч|godech|0|43.0111|23.04723;sofiya-oblast|Горна Малина|gorna-malina|0|42.70212|23.7685;sofiya-oblast|Долна баня|dolna-banya|0|42.31068|23.76479;sofiya-oblast|Драгоман|dragoman|0|42.9189|22.9317;sofiya-oblast|Елин Пелин|elin-pelin|0|42.66907|23.60131;sofiya-oblast|Етрополе|etropole|0|42.83464|23.99866;sofiya-oblast|Златица|zlatitsa|0|42.71478|24.13905;sofiya-oblast|Ихтиман|ihtiman|0|42.43824|23.81617;sofiya-oblast|Копривщица|koprivshtitsa|0|42.63612|24.36029;sofiya-oblast|Костенец|kostenets|0|42.30597|23.86262;sofiya-oblast|Костинброд|kostinbrod|0|42.81302|23.21543;sofiya-oblast|Мирково|mirkovo|0|42.62286|23.94754;sofiya-oblast|Пирдоп|pirdop|0|42.70337|24.17705;sofiya-oblast|Правец|pravets|0|42.89425|23.91884;sofiya-oblast|Самоков|samokov|0|42.337|23.5528;sofiya-oblast|Своге|svoge|0|42.96208|23.34392;sofiya-oblast|Сливница|slivnitsa|0|42.85197|23.03787;sofiya-oblast|Чавдар|chavdar|0|42.65993|24.05609;sofiya-oblast|Челопеч|chelopech|0|42.69955|24.08466;stara-zagora|Братя Даскалови|bratya-daskalovi|0|42.32669|25.21929;stara-zagora|Гурково|gurkovo|0|42.65727|25.79539;stara-zagora|Гълъбово|galabovo|0|42.13578|25.86513;stara-zagora|Казанлък|kazanlak|0|42.61944|25.39296;stara-zagora|Мъглиж|maglizh|0|42.60677|25.54544;stara-zagora|Николаево|nikolaevo|0|42.63006|25.79125;stara-zagora|Опан|opan|0|42.1916|25.71639;stara-zagora|Павел баня|pavel-banya|0|42.59531|25.20616;stara-zagora|Раднево|radnevo|0|42.29226|25.93662;stara-zagora|Стара Загора|stara-zagora|1|42.42578|25.63446;stara-zagora|Чирпан|chirpan|0|42.20207|25.32485;targovishte|Антоново|antonovo|0|43.14924|26.1606;targovishte|Омуртаг|omurtag|0|43.10828|26.41768;targovishte|Опака|opaka|0|43.44697|26.17375;targovishte|Попово|popovo|0|43.34906|26.22682;targovishte|Търговище|targovishte|0|43.24936|26.57274;haskovo|Димитровград|dimitrovgrad|0|42.0545|25.5945;haskovo|Ивайловград|ivaylovgrad|0|41.5267|26.12427;haskovo|Любимец|lyubimets|0|41.84737|26.08554;haskovo|Маджарово|madzharovo|0|41.6333|25.8603;haskovo|Минерални бани|mineralni-bani|0|41.88139|25.3323;haskovo|Свиленград|svilengrad|0|41.76549|26.20194;haskovo|Симеоновград|simeonovgrad|0|42.03499|25.831;haskovo|Стамболово|stambolovo|0|41.71036|25.67938;haskovo|Тополовград|topolovgrad|0|42.0851|26.33309;haskovo|Харманли|harmanli|0|41.93041|25.90259;haskovo|Хасково|haskovo|1|41.93444|25.55545;shumen|Велики Преслав|veliki-preslav|0|43.16454|26.81797;shumen|Венец|venets|0|43.522|26.91433;shumen|Върбица|varbitsa|0|42.99818|26.67269;shumen|Каолиново|kaolinovo|0|43.6166|27.0915;shumen|Каспичан|kaspichan|0|43.31783|27.15412;shumen|Никола Козлево|nikola-kozlevo|0|43.54582|27.24636;shumen|Нови пазар|novi-pazar|0|43.34726|27.19706;shumen|Смядово|smyadovo|0|43.06343|27.01333;shumen|Хитрино|hitrino|0|43.43514|26.88767;shumen|Шумен|shumen|1|43.27124|26.93613;yambol|Болярово|bolyarovo|0|42.1493|26.80776;yambol|Елхово|elhovo|0|42.17203|26.56932;yambol|Стралджа|straldzha|0|42.60023|26.68971;yambol|Тунджа|tundzha|0|42.37835|26.46931;yambol|Ямбол|yambol|0|42.4842|26.5035$seed$, ';') AS v
JOIN public.regions r ON r.slug = split_part(v,'|',1);

INSERT INTO public.neighborhoods (municipality_id, name, slug, sort_order)
SELECT m.id, split_part(v,'|',2), split_part(v,'|',3), split_part(v,'|',4)::int
FROM regexp_split_to_table($seed$sofiya|кв. Младост|kv-mladost|0;sofiya|кв. Люлин|kv-lyulin|1;sofiya|Център|tsentar|2;sofiya|кв. Лозенец|kv-lozenets|3;sofiya|кв. Витоша|kv-vitosha|4;sofiya|кв. Студентски град|kv-studentski-grad|5;sofiya|кв. Дружба|kv-druzhba|6;varna|кв. Чайка|kv-chayka|0;varna|кв. Левски|kv-levski|1;varna|Център|tsentar|2;varna|кв. Аспарухово|kv-asparuhovo|3;plovdiv|кв. Тракия|kv-trakiya|0;plovdiv|кв. Смирненски|kv-smirnenski|1;plovdiv|кв. Кършияка|kv-karshiyaka|2;plovdiv|Център|tsentar|3;burgas|кв. Лазур|kv-lazur|0;burgas|кв. Меден рудник|kv-meden-rudnik|1;burgas|кв. Изгрев|kv-izgrev|2;burgas|Център|tsentar|3;ruse|кв. Възраждане|kv-vazrazhdane|0;ruse|кв. Здравец|kv-zdravets|1;ruse|кв. Дружба|kv-druzhba|2;ruse|Център|tsentar|3;stara-zagora|кв. Железник|kv-zheleznik|0;stara-zagora|кв. Казански|kv-kazanski|1;stara-zagora|кв. Самара|kv-samara|2;stara-zagora|Център|tsentar|3;pleven|кв. Сторгозия|kv-storgoziya|0;pleven|кв. Дружба|kv-druzhba|1;pleven|кв. Мара Денчева|kv-mara-dencheva|2;pleven|Център|tsentar|3;sliven|кв. Българка|kv-balgarka|0;sliven|кв. Сини камъни|kv-sini-kamani|1;sliven|Център|tsentar|2;dobrich|кв. Балик|kv-balik|0;dobrich|кв. Дружба|kv-druzhba|1;dobrich|Център|tsentar|2;shumen|кв. Тракия|kv-trakiya|0;shumen|кв. Боян Българанов|kv-boyan-balgaranov|1;shumen|Център|tsentar|2;pernik|кв. Изток|kv-iztok|0;pernik|кв. Тева|kv-teva|1;pernik|Център|tsentar|2;haskovo|кв. Орфей|kv-orfey|0;haskovo|кв. Бадема|kv-badema|1;haskovo|Център|tsentar|2;blagoevgrad|кв. Еленово|kv-elenovo|0;blagoevgrad|кв. Струмско|kv-strumsko|1;blagoevgrad|Център|tsentar|2;veliko-tarnovo|кв. Колю Фичето|kv-kolyu-ficheto|0;veliko-tarnovo|кв. Бузлуджа|kv-buzludzha|1;veliko-tarnovo|кв. Картала|kv-kartala|2;veliko-tarnovo|Център|tsentar|3$seed$, ';') AS v
JOIN public.municipalities m ON m.slug = split_part(v,'|',1);

-- 2. Tasks keep their text city/neighborhood columns; structured refs are added alongside.
ALTER TABLE public.tasks
  ADD COLUMN municipality_id uuid REFERENCES public.municipalities(id) ON DELETE SET NULL,
  ADD COLUMN region_id uuid REFERENCES public.regions(id) ON DELETE SET NULL;
CREATE INDEX tasks_municipality_id_idx ON public.tasks(municipality_id);
CREATE INDEX tasks_region_id_idx ON public.tasks(region_id);

UPDATE public.tasks t
SET municipality_id = m.id, region_id = m.region_id
FROM public.municipalities m
WHERE t.municipality_id IS NULL AND t.city IS NOT NULL AND m.name = t.city;

-- Keep the structured refs in sync with the text columns for every insert/update.
CREATE OR REPLACE FUNCTION public.tasks_resolve_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE m record;
BEGIN
  IF NEW.city IS NULL THEN
    NEW.municipality_id := NULL;
    NEW.region_id := NULL;
    RETURN NEW;
  END IF;
  SELECT id, region_id INTO m FROM public.municipalities WHERE name = NEW.city LIMIT 1;
  IF m.id IS NOT NULL THEN
    NEW.municipality_id := m.id;
    NEW.region_id := m.region_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tasks_resolve_location
BEFORE INSERT OR UPDATE OF city ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_resolve_location();

DROP FUNCTION IF EXISTS public.feed_tasks(integer, timestamptz, text, integer, text, text, text, text);

-- 3. Feed: filter by област (broad) or община (specific).
CREATE OR REPLACE FUNCTION public.feed_tasks(
  _limit integer DEFAULT 20,
  _cursor timestamp with time zone DEFAULT NULL,
  _seed text DEFAULT 'seed',
  _promo_offset integer DEFAULT 0,
  _category text DEFAULT NULL,
  _city text DEFAULT NULL,
  _neighborhood text DEFAULT NULL,
  _q text DEFAULT NULL,
  _region text DEFAULT NULL
)
RETURNS TABLE(id uuid, title text, description text, category text, budget numeric, city text, neighborhood text, status task_status, unlock_cost integer, created_at timestamp with time zone, bumped_at timestamp with time zone, user_id uuid, author text, images text[], is_top boolean, is_urgent boolean, promo_expires_at timestamp with time zone, promoted_slot boolean, unlock_count integer, max_unlocks integer, author_rating numeric, author_review_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT t.* FROM public.tasks t
    WHERE t.status = 'active' AND t.deleted_at IS NULL
      AND (_category IS NULL OR t.category = _category)
      AND (_city IS NULL OR t.city = _city)
      AND (_neighborhood IS NULL OR t.neighborhood = _neighborhood)
      AND (_region IS NULL OR t.region_id = (SELECT r.id FROM public.regions r WHERE r.slug = _region))
      AND (_q IS NULL OR _q = '' OR t.title ILIKE '%' || _q || '%' OR t.description ILIKE '%' || _q || '%')
  ),
  tops AS (
    SELECT b.*, tp.expires_at AS top_expires FROM base b
    JOIN LATERAL (
      SELECT MAX(p.expires_at) AS expires_at FROM public.task_promotions p
      WHERE p.task_id = b.id AND p.type = 'top' AND p.expires_at > now()
    ) tp ON tp.expires_at IS NOT NULL
  ),
  promoted AS (
    SELECT * FROM tops ORDER BY md5(_seed || tops.id::text)
    LIMIT LEAST(GREATEST(_limit, 1), 4) OFFSET GREATEST(_promo_offset, 0)
  ),
  normal AS (
    SELECT b.* FROM base b
    WHERE NOT EXISTS (SELECT 1 FROM tops t WHERE t.id = b.id)
      AND (_cursor IS NULL OR b.bumped_at < _cursor)
    ORDER BY b.bumped_at DESC LIMIT GREATEST(_limit, 1)
  ),
  combined AS (
    SELECT p.*, true AS promoted_slot, 0 AS ord FROM promoted p
    UNION ALL
    SELECT n.*, NULL::timestamptz AS top_expires, false AS promoted_slot, 1 AS ord FROM normal n
  )
  SELECT c.id, c.title, c.description, c.category, c.budget, c.city, c.neighborhood, c.status,
    c.unlock_cost, c.created_at, c.bumped_at, c.user_id, pr.full_name AS author,
    COALESCE((SELECT array_agg(i.image_url ORDER BY i.sort_order) FROM public.task_images i WHERE i.task_id = c.id), ARRAY[]::text[]) AS images,
    (c.top_expires IS NOT NULL) AS is_top,
    EXISTS (SELECT 1 FROM public.task_promotions u WHERE u.task_id = c.id AND u.type = 'urgent' AND u.expires_at > now()) AS is_urgent,
    c.top_expires AS promo_expires_at, c.promoted_slot, c.unlock_count, c.max_unlocks,
    pr.rating_as_client AS author_rating, pr.review_count_as_client AS author_review_count
  FROM combined c
  LEFT JOIN public.profiles pr ON pr.id = c.user_id
  ORDER BY c.ord, (CASE WHEN c.ord = 0 THEN md5(_seed || c.id::text) ELSE NULL END), c.bumped_at DESC;
$function$;

-- 4. Nearby municipalities with open tasks, so a quiet община never renders an empty page.
CREATE OR REPLACE FUNCTION public.region_municipality_counts(_region text, _category text DEFAULT NULL)
RETURNS TABLE(slug text, name text, task_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT m.slug, m.name, COUNT(t.id) AS task_count
  FROM public.municipalities m
  JOIN public.regions r ON r.id = m.region_id
  LEFT JOIN public.tasks t
    ON t.municipality_id = m.id
   AND t.status = 'active'
   AND t.deleted_at IS NULL
   AND (_category IS NULL OR t.category = _category)
  WHERE r.slug = _region
  GROUP BY m.slug, m.name
  ORDER BY COUNT(t.id) DESC, m.name;
$$;
REVOKE ALL ON FUNCTION public.region_municipality_counts(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.region_municipality_counts(text, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.tasks_resolve_location() FROM PUBLIC, anon, authenticated;