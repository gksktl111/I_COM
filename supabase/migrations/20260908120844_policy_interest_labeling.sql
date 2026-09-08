-- Six UI interests are independent of relevance, publication and eligibility.
-- Automatic labels are proposals. Reviews are immutable, explicitly attributed events.
create function public.policy_label_version() returns text
language sql immutable security invoker set search_path=pg_catalog as $$ select 'interest-taxonomy-2/rules-1'::text $$;
create function public.policy_label_rules() returns jsonb
language sql immutable security invoker set search_path=pg_catalog as $$ select $rules$
[
  {
    "id": "pregnancy-preconception",
    "category": "pregnancy_birth",
    "subcategory": "preconception",
    "benefitPattern": "(임신[[:space:]]*(준비|사전)|가임력|예비[[:space:]]*(부모|부부)).{0,35}(검사|검진|상담|엽산|지원)|엽산제.{0,25}(지급|지원|제공)",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)",
    "titlePattern": "임신|예비부모|예비부부|가임력"
  },
  {
    "id": "pregnancy-infertility",
    "category": "pregnancy_birth",
    "subcategory": "infertility",
    "benefitPattern": "(난임|불임|인공수정|체외수정|난자[[:space:]]*동결).{0,35}(시술|약제|검사|비용|지원)",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)"
  },
  {
    "id": "pregnancy-prenatal",
    "category": "pregnancy_birth",
    "subcategory": "prenatal",
    "benefitPattern": "(임신|임산부|산전|임부|태아).{0,35}(검사|검진|진료|철분|엽산|교통비|축하금|지원금|건강관리)|기형아[[:space:]]*검사",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)"
  },
  {
    "id": "pregnancy-birth-grant",
    "category": "pregnancy_birth",
    "subcategory": "birth_grant",
    "benefitPattern": "(출산|출생|신생아).{0,15}(축하금|장려금|지원금|축하[[:space:]]*(용품|선물))|첫만남[[:space:]]*이용권",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)"
  },
  {
    "id": "pregnancy-postpartum",
    "category": "pregnancy_birth",
    "subcategory": "postpartum",
    "benefitPattern": "산후[[:space:]]*(조리|회복|관리)|산모[·ㆍ[:space:]]*신생아[[:space:]]*건강관리",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)"
  },
  {
    "id": "pregnancy-prenatal-title",
    "category": "pregnancy_birth",
    "subcategory": "prenatal",
    "benefitPattern": "(현금|상품권|지역화폐|바우처|지원금|[0-9]+[[:space:]]*만[[:space:]]*원|본인부담금).{0,35}(지원|지급|충전|환급|보조)|현금[[:space:]]*지원",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)",
    "titlePattern": "임신[[:space:]]*(축하금|지원금)"
  },
  {
    "id": "pregnancy-birth-title",
    "category": "pregnancy_birth",
    "subcategory": "birth_grant",
    "benefitPattern": "(현금|상품권|지역화폐|바우처|지원금|[0-9]+[[:space:]]*만[[:space:]]*원|본인부담금).{0,35}(지원|지급|충전|환급|보조)|현금[[:space:]]*지원",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)",
    "titlePattern": "출산[[:space:]]*(축하금|장려금)|출생[[:space:]]*축하금|첫만남[[:space:]]*이용권"
  },
  {
    "id": "pregnancy-postpartum-title",
    "category": "pregnancy_birth",
    "subcategory": "postpartum",
    "benefitPattern": "(현금|상품권|지역화폐|바우처|지원금|[0-9]+[[:space:]]*만[[:space:]]*원|본인부담금).{0,35}(지원|지급|충전|환급|보조)|현금[[:space:]]*지원",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)",
    "titlePattern": "산후[[:space:]]*조리[[:space:]]*(비|경비)"
  },
  {
    "id": "parenting-allowance",
    "category": "parenting_childcare",
    "subcategory": "child_allowance",
    "benefitPattern": "(아동[[:space:]]*양육비|양육[[:space:]]*(수당|비)|아동[[:space:]]*수당|부모[[:space:]]*(급여|수당)).{0,30}(지원|지급|보조)|가정위탁아동양육수당",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)"
  },
  {
    "id": "parenting-basic-fee",
    "category": "parenting_childcare",
    "subcategory": "childcare_fee",
    "benefitPattern": "보육료|유아[[:space:]]*학비|누리[[:space:]]*과정.{0,25}(부담금|비용|지원)|유치원.{0,30}(학부모부담금|교육비|이용료|학비)|어린이집.{0,30}(입소료|입학준비금|이용료)",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)|창업|기업[[:space:]]*보육"
  },
  {
    "id": "parenting-access",
    "category": "parenting_childcare",
    "subcategory": "childcare_access",
    "benefitPattern": "(어린이집|유치원|보육시설).{0,30}(입소[[:space:]]*지원|우선[[:space:]]*(입소|입학)|통학[[:space:]]*(버스|차량)|보육[[:space:]]*서비스[[:space:]]*제공)",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)|창업|기업[[:space:]]*보육"
  },
  {
    "id": "parenting-service",
    "category": "parenting_childcare",
    "subcategory": "parenting_service",
    "benefitPattern": "(양육|육아|부모|보호자).{0,20}(상담|교육|코칭|휴직|휴가)|자녀[[:space:]]*돌봄[[:space:]]*휴가비",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)|취업[[:space:]]*교육|직업[[:space:]]*훈련"
  },
  {
    "id": "care-home",
    "category": "care",
    "subcategory": "home_visit",
    "benefitPattern": "(아이[[:space:]]*돌봄|돌보미|방문[[:space:]]*돌봄).{0,35}(서비스|지원|파견|제공|이용|본인부담금)|가정.{0,15}방문.{0,20}(아동[[:space:]]*보호|돌봄)",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)|휴가|휴직|급식|학습[[:space:]]*지도만|노인[[:space:]]*전용|성인[[:space:]]*전용"
  },
  {
    "id": "care-home-title",
    "category": "care",
    "subcategory": "home_visit",
    "benefitPattern": "(현금|상품권|지역화폐|바우처|지원금|[0-9]+[[:space:]]*만[[:space:]]*원|본인부담금).{0,35}(지원|지급|충전|환급|보조)|현금[[:space:]]*지원",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)|휴가|휴직|급식|학습[[:space:]]*지도만|노인[[:space:]]*전용|성인[[:space:]]*전용",
    "titlePattern": "아이[[:space:]]*돌봄[[:space:]]*(서비스|지원사업).{0,15}본인부담금"
  },
  {
    "id": "care-center",
    "category": "care",
    "subcategory": "center",
    "benefitPattern": "(다함께[[:space:]]*돌봄|공동[[:space:]]*육아[[:space:]]*나눔터|돌봄[[:space:]]*센터).{0,30}(돌봄|보호|서비스|이용|제공)|지역아동센터.{0,25}(보호|돌봄)",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)|휴가|휴직|급식|학습[[:space:]]*지도만|노인[[:space:]]*전용|성인[[:space:]]*전용|시설비|인건비|운영비"
  },
  {
    "id": "care-afterschool",
    "category": "care",
    "subcategory": "afterschool",
    "benefitPattern": "방과[[:space:]]*후.{0,25}(돌봄|보호)|초등[[:space:]]*돌봄[[:space:]]*교실",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)|휴가|휴직|급식|학습[[:space:]]*지도만|노인[[:space:]]*전용|성인[[:space:]]*전용"
  },
  {
    "id": "care-emergency",
    "category": "care",
    "subcategory": "emergency",
    "benefitPattern": "(긴급|일시|틈새).{0,20}돌봄.{0,30}(지원|제공|서비스)|동행[[:space:]]*돌봄[[:space:]]*제공",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)|휴가|휴직|급식|학습[[:space:]]*지도만|노인[[:space:]]*전용|성인[[:space:]]*전용"
  },
  {
    "id": "education-participation",
    "category": "child_education",
    "subcategory": "education_participation",
    "benefitPattern": "교육비|학용품[[:space:]]*(비|지원)|교복[[:space:]]*(비|지원)|입학[[:space:]]*준비금|통학[[:space:]]*(비|차량|버스)[[:space:]]*(지원|제공)|고교[[:space:]]*학비|학교[[:space:]]*운영[[:space:]]*지원비|방과후학교[[:space:]]*수강권",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)|유치원|어린이집|보육료|유아학비|누리과정|대학생|대학원|성인[[:space:]]*전용|직업[[:space:]]*훈련|취업[[:space:]]*교육|부모[[:space:]]*교육|보호자[[:space:]]*교육"
  },
  {
    "id": "education-school-tuition",
    "category": "child_education",
    "subcategory": "education_participation",
    "benefitPattern": "(초등|중등|고등|중학교|고등학교|중·고등학교|초·중·고).{0,40}(입학금|수업료|학비|장학금|교육[[:space:]]*정보화)",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)|유치원|어린이집|보육료|유아학비|누리과정|대학생|대학원|성인[[:space:]]*전용|직업[[:space:]]*훈련|취업[[:space:]]*교육|부모[[:space:]]*교육|보호자[[:space:]]*교육"
  },
  {
    "id": "education-learning",
    "category": "child_education",
    "subcategory": "learning_support",
    "benefitPattern": "방문[[:space:]]*학습|학습[[:space:]]*(지도|지원|멘토링|교재)|학원[[:space:]]*(무료[[:space:]]*)?수강[[:space:]]*(지원|제공)|독서[[:space:]]*지도",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)|유치원|어린이집|보육료|유아학비|누리과정|대학생|대학원|성인[[:space:]]*전용|직업[[:space:]]*훈련|취업[[:space:]]*교육|부모[[:space:]]*교육|보호자[[:space:]]*교육|현장[[:space:]]*학습"
  },
  {
    "id": "health-checkup",
    "category": "health",
    "subcategory": "checkup",
    "benefitPattern": "건강[[:space:]]*검진|건강[[:space:]]*검사|임신[[:space:]]*초기[[:space:]]*검사|기형아[[:space:]]*검사|선천성.{0,15}검사|체성분[[:space:]]*검사|구강[[:space:]]*검진|영유아[[:space:]]*검진",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)"
  },
  {
    "id": "health-vaccination",
    "category": "health",
    "subcategory": "vaccination",
    "benefitPattern": "예방[[:space:]]*접종|백신[[:space:]]*(접종|지원|제공)",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)"
  },
  {
    "id": "health-treatment",
    "category": "health",
    "subcategory": "treatment",
    "benefitPattern": "(진료|치료|수술|난임[[:space:]]*시술).{0,20}(서비스[[:space:]]*제공|지원|실시|제공)|치과[[:space:]]*(진료|치료)|언어[[:space:]]*치료",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)|장례|안치료"
  },
  {
    "id": "health-medical-cost",
    "category": "health",
    "subcategory": "medical_cost",
    "benefitPattern": "의료비|진료비|치료비|수술비|약제비|약품비|건강[[:space:]]*보험료|건강보장[[:space:]]*보험료|난임.{0,15}시술비",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)|장례|안치료"
  },
  {
    "id": "health-rehabilitation",
    "category": "health",
    "subcategory": "rehabilitation",
    "benefitPattern": "(재활|발달[[:space:]]*재활).{0,25}(치료|서비스|훈련|지원)|물리[[:space:]]*치료|작업[[:space:]]*치료",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)|직업[[:space:]]*재활"
  },
  {
    "id": "health-mental",
    "category": "health",
    "subcategory": "mental_health",
    "benefitPattern": "심리[[:space:]]*(검사|상담|치료)|정신[[:space:]]*건강.{0,20}(상담|치료|서비스)|우울[[:space:]]*(검사|선별|상담)|놀이[[:space:]]*치료",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)"
  },
  {
    "id": "housing-access",
    "category": "housing_living",
    "subcategory": "housing_access",
    "benefitPattern": "(임대[[:space:]]*주택|공공[[:space:]]*주택|전세[[:space:]]*임대|매입[[:space:]]*임대).{0,30}(공급|입주|지원|제공)|주택[[:space:]]*특별[[:space:]]*공급",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)|주차장|상가|사업자"
  },
  {
    "id": "housing-cost",
    "category": "housing_living",
    "subcategory": "housing_cost",
    "benefitPattern": "월[[:space:]]*(임차료|임대료|세)[[:space:]]*(지원|보조|대출)|주거[[:space:]]*급여|주거비[[:space:]]*(지원|보조)|전세[[:space:]]*(자금|보증금).{0,30}(대출|이자|지원)|주택.{0,20}대출[[:space:]]*이자[[:space:]]*지원",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)|주차장|상가|사업자"
  },
  {
    "id": "housing-cost-title",
    "category": "housing_living",
    "subcategory": "housing_cost",
    "benefitPattern": "(현금|상품권|지역화폐|바우처|지원금|[0-9]+[[:space:]]*만[[:space:]]*원|본인부담금).{0,35}(지원|지급|충전|환급|보조)|현금[[:space:]]*지원",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)|주차장|상가|사업자",
    "titlePattern": "주거[[:space:]]*비용[[:space:]]*지원|월세[[:space:]]*지원"
  },
  {
    "id": "housing-moving",
    "category": "housing_living",
    "subcategory": "moving",
    "benefitPattern": "이사[[:space:]]*비|중개[[:space:]]*수수료.{0,15}지원",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)|사업자|상가"
  },
  {
    "id": "housing-utilities",
    "category": "housing_living",
    "subcategory": "utilities",
    "benefitPattern": "(전기[[:space:]]*요금|도시[[:space:]]*가스[[:space:]]*요금|수도[[:space:]]*요금|난방비|냉방비|연료비).{0,25}(지원|감면|할인|보조)|에너지[[:space:]]*바우처",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)|운영비|시설비|어린이집[[:space:]]*지원"
  },
  {
    "id": "housing-livelihood",
    "category": "housing_living",
    "subcategory": "livelihood",
    "benefitPattern": "생계[[:space:]]*(급여|비)|생활[[:space:]]*(보조금|안정[[:space:]]*지원금)|기초[[:space:]]*생활[[:space:]]*비|필수[[:space:]]*생활[[:space:]]*(용품|비).{0,25}(지원|지급|제공)",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)|사업자|기업"
  },
  {
    "id": "housing-food",
    "category": "housing_living",
    "subcategory": "food",
    "benefitPattern": "급식[[:space:]]*(비|카드|지원|제공)|급식형태[[:space:]]*선택[[:space:]]*지원|식료품.{0,20}(지원|제공)|양곡.{0,20}(지원|할인)|식사.{0,15}(배달|제공)|도시락.{0,15}(지원|제공)",
    "excludePattern": "지원[[:space:]]*(제외|불가|하지|안[[:space:]]*함)|대상[[:space:]]*(제외|아님)|지원되지|제공하지|미지원|구비[[:space:]]*서류|제출[[:space:]]*서류|신청서[[:space:]]*(제출|작성)|증명서[[:space:]]*(제출|발급)|조리[[:space:]]*교육|요리[[:space:]]*강좌"
  }
]
$rules$::jsonb $$;

create table public.policy_label_observations (
  id bigint generated always as identity primary key,
  source_id uuid not null references public.policies(source_id),
  snapshot_id uuid not null,
  normalizer_version text not null,
  display_hash text not null,
  normalized_hash text not null,
  evaluator_version text not null,
  assessment jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  foreign key(source_id,snapshot_id) references public.policy_source_snapshots(source_id,id),
  unique(source_id,snapshot_id,normalizer_version,display_hash,normalized_hash,evaluator_version),
  check (jsonb_typeof(assessment)='object' and assessment->>'status' in ('PROPOSED','NEEDS_REVIEW','OUT_OF_TAXONOMY'))
);
create table public.policy_label_reviews (
  id bigint generated always as identity primary key,
  observation_id bigint not null references public.policy_label_observations(id),
  expected_review_id bigint,
  review_key text not null unique check(length(review_key)>0),
  reviewer text not null check(length(reviewer)>0),
  review_kind text not null check(review_kind in ('HUMAN','AI_ASSISTED')),
  reason text not null check(length(reason)>0),
  assessment jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  check (jsonb_typeof(assessment)='object' and assessment->>'status' in ('VERIFIED','NEEDS_REVIEW','OUT_OF_TAXONOMY','OUT_OF_SCOPE'))
);
create index policy_label_reviews_observation_idx on public.policy_label_reviews(observation_id,id desc);
alter table public.policy_label_observations enable row level security;
alter table public.policy_label_reviews enable row level security;
revoke all on public.policy_label_observations,public.policy_label_reviews from public,anon,authenticated,service_role;
grant select,insert on public.policy_label_observations,public.policy_label_reviews to service_role;
revoke all on sequence public.policy_label_observations_id_seq,public.policy_label_reviews_id_seq from public,anon,authenticated,service_role;
grant usage,select on sequence public.policy_label_observations_id_seq,public.policy_label_reviews_id_seq to service_role;

-- Keep exact source excerpts; never treat exclusion/administrative clauses as positive evidence.
create function public.policy_label_clauses(p_text text) returns setof text
language sql immutable security invoker set search_path=pg_catalog as $$
 select btrim(c) from regexp_split_to_table(coalesce(p_text,''), E'[\\n\\r;]+') c
 where length(btrim(c))>0 and c !~ '제외|미지원|지원하지|해당하지|대상.{0,8}아[님닌]|구비서류|제출서류|증빙|문의처|불가'
$$;

create function public.policy_evaluate_labels(p_display jsonb) returns jsonb
language plpgsql immutable security invoker set search_path=pg_catalog,public as $$
declare
 v_labels jsonb:='[]'; v_categories jsonb; v_targets jsonb:='[]';
 v_rule jsonb; v_clause text; v_scope text; v_scope_field text; v_title text:=coalesce(p_display->>'name','');
 v_target text; v_evidence jsonb; v_status text; v_scope_pattern text;
 v_child text:='아동|어린이|영유아|영아|유아|유치원|초등|중학생|중학교|고등학생|고등학교|초[·ㆍ,[:space:]]*중|중[·ㆍ,[:space:]]*고|청소년|미성년|(^|[^0-9])([0-9]|1[0-9])[[:space:]]*세[[:space:]]*(미만|이하)|(^|[^0-9])([0-9]|1[0-9])[[:space:]]*세?[[:space:]]*[~∼-][[:space:]]*([0-9]|1[0-9])[[:space:]]*세';
 v_family text:='임신|임산부|산모|산후|출산|난임|임부|예비부모|신혼|자녀|양육|보육|한부모|조손|다문화|가정위탁|입양|소년소녀|다자녀|다둥이';
 v_pregnancy text:='임신|임산부|산모|산후|출산|난임|임부|산전|예비부모|가임|신생아|출생아|첫만남|난자|정자';
 v_index integer:=0;
begin
 if jsonb_typeof(p_display) is distinct from 'object' then p_display:='{}'; end if;
 select string_agg(c,' ') into v_target from public.policy_label_clauses(p_display->>'target_text') c;
 if coalesce(v_target,'') ~ v_child then v_targets:=v_targets||'"child_adolescent"'::jsonb; end if;
 if coalesce(v_target,'') ~ v_family then v_targets:=v_targets||'"family_household"'::jsonb; end if;
 if coalesce(v_target,'') ~ v_pregnancy then v_targets:=v_targets||'"pregnancy_birth_household"'::jsonb; end if;
 for v_clause in select * from public.policy_label_clauses(p_display->>'benefit_text') loop
  v_index:=v_index+1;
  for v_rule in select * from jsonb_array_elements(public.policy_label_rules()) loop
   if v_clause !~ (v_rule->>'benefitPattern') then continue; end if;
   if v_rule ? 'titlePattern' and v_title !~ (v_rule->>'titlePattern') then continue; end if;
   if v_rule ? 'excludePattern' and (v_clause ~ (v_rule->>'excludePattern') or v_title ~ (v_rule->>'excludePattern')) then continue; end if;
   v_scope_pattern:=case v_rule->>'category'
    when 'pregnancy_birth' then v_pregnancy
    when 'child_education' then v_child
    when 'health' then v_child||'|'||v_pregnancy
    else v_child||'|'||v_family end;
   v_scope:=null; v_scope_field:=null;
   select c into v_scope from public.policy_label_clauses(p_display->>'target_text') c where c ~ v_scope_pattern limit 1;
   if v_scope is not null then v_scope_field:='target_text';
   elsif v_clause ~ v_scope_pattern then v_scope:=v_clause; v_scope_field:='benefit_text';
   elsif v_title ~ v_scope_pattern and v_title !~ '제외|창업보육|임산물|성인[[:space:]]*전용|대학생|대학원' then
    v_scope:=v_title; v_scope_field:='name';
   end if;
   if v_scope is null then continue; end if;
   v_evidence:=jsonb_build_array(jsonb_build_object('field','benefit_text','excerpt',v_clause),jsonb_build_object('field',v_scope_field,'excerpt',v_scope));
   if v_rule ? 'titlePattern' then v_evidence:=v_evidence||jsonb_build_array(jsonb_build_object('field','name','excerpt',v_title)); end if;
   v_labels:=v_labels||jsonb_build_array(jsonb_build_object('category',v_rule->>'category','subcategory',v_rule->>'subcategory',
    'path','benefit:'||v_index,'rule',v_rule->>'id','evidence',v_evidence));
  end loop;
 end loop;
 select coalesce(jsonb_agg(c order by c),'[]') into v_categories from (select distinct l->>'category' c from jsonb_array_elements(v_labels) l) s;
 v_status:=case when jsonb_array_length(v_labels)>0 then 'PROPOSED'
  when coalesce(v_target,'') ~ (v_child||'|'||v_family) and coalesce(p_display->>'benefit_text','') ~ '관람료|문화[[:space:]]*활동|체육[[:space:]]*활동|가족[[:space:]]*관계|고향[[:space:]]*방문' then 'OUT_OF_TAXONOMY'
  else 'NEEDS_REVIEW' end;
 return jsonb_build_object('version',public.policy_label_version(),'status',v_status,'categories',v_categories,'labels',v_labels,'targets',v_targets,
  'reason',case v_status when 'PROPOSED' then '지원내용과 대상 근거를 연결한 자동 제안입니다. 하위 경로와 대상 범위는 검수가 필요합니다.'
   when 'OUT_OF_TAXONOMY' then '서비스 관련 지원이나 현재 6개 분야에 맞는 목적 근거가 확인되지 않아 사전 검토가 필요합니다.'
   else '지원 목적 또는 대상 근거가 부족하거나 경계가 불명확하여 원문 검수가 필요합니다.' end);
end $$;

create function public.policy_assign_labels(p_source_id uuid) returns bigint
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_policy public.policies%rowtype; v_assessment jsonb; v_id bigint;
begin
 select * into v_policy from public.policies where source_id=p_source_id for update;
 if not found or v_policy.relevance->>'status' is distinct from 'RELATED' then return null; end if;
 select id into v_id from public.policy_label_observations where source_id=p_source_id
  and snapshot_id=v_policy.applied_snapshot_id and normalizer_version=v_policy.normalized->>'normalizerVersion'
  and display_hash=v_policy.normalized->>'displayHash' and normalized_hash=md5(v_policy.normalized::text) and evaluator_version=public.policy_label_version();
 if v_id is not null then return v_id; end if;
 v_assessment:=public.policy_evaluate_labels(v_policy.normalized->'display');
 insert into public.policy_label_observations(source_id,snapshot_id,normalizer_version,display_hash,normalized_hash,evaluator_version,assessment)
 values(p_source_id,v_policy.applied_snapshot_id,v_policy.normalized->>'normalizerVersion',v_policy.normalized->>'displayHash',md5(v_policy.normalized::text),public.policy_label_version(),v_assessment)
 returning id into v_id;
 return v_id;
end $$;
create function public.policy_label_on_activation() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if new.relevance->>'status'='RELATED' then perform public.policy_assign_labels(new.source_id); end if;
 return new;
end $$;
create trigger policy_label_on_activation after insert or update of relevance,normalized,applied_snapshot_id on public.policies
for each row execute function public.policy_label_on_activation();

create view public.policy_current_labels with (security_invoker=true) as
 select p.source_id,o.id as observation_id,o.snapshot_id,o.normalizer_version,o.display_hash,o.evaluator_version,
 coalesce(r.assessment,o.assessment) as assessment,o.assessment as proposal,
 o.created_at,r.id as review_id,r.reviewer,r.review_kind,r.created_at as reviewed_at
 from public.policies p join public.policy_label_observations o on o.source_id=p.source_id
 and o.snapshot_id=p.applied_snapshot_id and o.normalizer_version=p.normalized->>'normalizerVersion'
 and o.display_hash=p.normalized->>'displayHash' and o.normalized_hash=md5(p.normalized::text) and o.evaluator_version=public.policy_label_version()
 left join lateral (select * from public.policy_label_reviews where observation_id=o.id order by id desc limit 1) r on true
 where p.catalog_status='ACTIVE';
revoke all on public.policy_current_labels from public,anon,authenticated,service_role;
grant select on public.policy_current_labels to service_role;

-- Explicit, retryable batch operation; activation itself never relies on a scheduler.
create function public.policy_label_backfill(p_after uuid default null,p_limit integer default 100) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_row record; v_after uuid; v_count integer:=0;
begin
 if p_limit<1 or p_limit>100 or p_limit is null then raise exception 'INVALID_LABEL_BATCH'; end if;
 for v_row in select source_id from public.policies where catalog_status='ACTIVE' and (p_after is null or source_id>p_after) order by source_id limit p_limit loop
  perform public.policy_assign_labels(v_row.source_id); v_after:=v_row.source_id; v_count:=v_count+1;
 end loop;
 return jsonb_build_object('processed',v_count,'after',v_after);
end $$;

-- No public execution, and no SECURITY DEFINER privileges are introduced.
revoke all on function public.policy_label_version(),public.policy_label_rules(),public.policy_label_clauses(text),public.policy_evaluate_labels(jsonb),public.policy_assign_labels(uuid),public.policy_label_on_activation(),public.policy_label_backfill(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.policy_label_version(),public.policy_label_rules(),public.policy_label_clauses(text),public.policy_evaluate_labels(jsonb),public.policy_assign_labels(uuid),public.policy_label_backfill(uuid,integer) to service_role;
notify pgrst,'reload schema';

-- Validate every append, including direct Data API inserts by the service role.
-- The policy row serializes source changes and all reviews of its observation.
create function public.policy_validate_label_review(p_observation bigint,p_assessment jsonb,p_expected_previous bigint) returns void
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
 v_observation public.policy_label_observations%rowtype; v_policy public.policies%rowtype;
 v_assessment jsonb:=p_assessment;
 v_label jsonb; v_evidence jsonb; v_categories jsonb; v_latest bigint;
begin
 select * into v_observation from public.policy_label_observations where id=p_observation;
 if not found then raise exception 'UNKNOWN_LABEL_OBSERVATION'; end if;
 select * into v_policy from public.policies where source_id=v_observation.source_id for update;
 if v_policy.catalog_status is distinct from 'ACTIVE' or v_policy.applied_snapshot_id is distinct from v_observation.snapshot_id
  or v_policy.normalized->>'normalizerVersion' is distinct from v_observation.normalizer_version
  or v_policy.normalized->>'displayHash' is distinct from v_observation.display_hash
  or md5(v_policy.normalized::text) is distinct from v_observation.normalized_hash
  or v_observation.evaluator_version is distinct from public.policy_label_version() then raise exception 'STALE_LABEL_REVIEW'; end if;
 select max(id) into v_latest from public.policy_label_reviews where observation_id=v_observation.id;
 if v_latest is distinct from p_expected_previous then raise exception 'LABEL_REVIEW_CONFLICT'; end if;
 if jsonb_typeof(v_assessment) is distinct from 'object'
  or v_assessment->>'version' is distinct from public.policy_label_version()
  or coalesce(v_assessment->>'status','') not in ('VERIFIED','NEEDS_REVIEW','OUT_OF_TAXONOMY','OUT_OF_SCOPE')
  or jsonb_typeof(v_assessment->'categories') is distinct from 'array'
  or jsonb_typeof(v_assessment->'labels') is distinct from 'array'
  or jsonb_typeof(v_assessment->'targets') is distinct from 'array'
  or coalesce(v_assessment->>'reason','')='' then raise exception 'INVALID_LABEL_ASSESSMENT'; end if;
 if (v_assessment->>'status'='VERIFIED' and jsonb_array_length(v_assessment->'labels')=0)
  or (v_assessment->>'status' in ('OUT_OF_TAXONOMY','OUT_OF_SCOPE') and jsonb_array_length(v_assessment->'labels')<>0)
  or exists(select 1 from jsonb_array_elements(v_assessment->'targets') t where jsonb_typeof(t)<>'string') then raise exception 'INVALID_LABEL_ASSESSMENT'; end if;
 for v_label in select * from jsonb_array_elements(v_assessment->'labels') loop
  if jsonb_typeof(v_label) is distinct from 'object'
   or jsonb_typeof(v_label->'category') is distinct from 'string'
   or jsonb_typeof(v_label->'subcategory') is distinct from 'string'
   or coalesce(v_label->>'path','')=''
   or jsonb_typeof(v_label->'evidence') is distinct from 'array' then raise exception 'INVALID_LABEL_EVIDENCE'; end if;
  if not exists(select 1 from jsonb_array_elements(public.policy_label_rules()) r where r->>'category'=v_label->>'category' and r->>'subcategory'=v_label->>'subcategory')
   and not (v_label->>'subcategory'='other' and v_label->>'category' in ('pregnancy_birth','parenting_childcare','care','health','child_education','housing_living')) then raise exception 'INVALID_LABEL_CATEGORY'; end if;
  if jsonb_array_length(v_label->'evidence')=0 or not exists(select 1 from jsonb_array_elements(v_label->'evidence') e where e->>'field'='benefit_text') then raise exception 'INVALID_LABEL_EVIDENCE'; end if;
  for v_evidence in select * from jsonb_array_elements(v_label->'evidence') loop
   if jsonb_typeof(v_evidence) is distinct from 'object'
    or jsonb_typeof(v_evidence->'excerpt') is distinct from 'string' or coalesce(v_evidence->>'field','') not in ('name','target_text','benefit_text','purpose_text','criteria_text')
    or coalesce(v_evidence->>'excerpt','')='' or position(v_evidence->>'excerpt' in coalesce(v_policy.normalized#>>array['display',v_evidence->>'field'],''))=0 then raise exception 'INVALID_LABEL_EVIDENCE'; end if;
  end loop;
 end loop;
 select coalesce(jsonb_agg(c order by c),'[]') into v_categories from (select distinct l->>'category' c from jsonb_array_elements(v_assessment->'labels') l) s;
 if v_categories is distinct from (select coalesce(jsonb_agg(c order by c),'[]') from jsonb_array_elements(v_assessment->'categories') c) then raise exception 'INVALID_LABEL_CATEGORY'; end if;
end $$;
create function public.policy_label_review_before_insert() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 perform public.policy_validate_label_review(new.observation_id,new.assessment,new.expected_review_id);
 return new;
end $$;
create trigger policy_label_review_before_insert before insert on public.policy_label_reviews
for each row execute function public.policy_label_review_before_insert();
revoke all on function public.policy_validate_label_review(bigint,jsonb,bigint),public.policy_label_review_before_insert() from public,anon,authenticated,service_role;
grant execute on function public.policy_validate_label_review(bigint,jsonb,bigint) to service_role;

create function public.policy_review_labels(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
 v_observation public.policy_label_observations%rowtype; v_policy public.policies%rowtype;
 v_previous public.policy_label_reviews%rowtype; v_assessment jsonb:=p_payload->'assessment'; v_id bigint;
begin
 select * into v_observation from public.policy_label_observations where id=(p_payload->>'observationId')::bigint;
 if not found then raise exception 'UNKNOWN_LABEL_OBSERVATION'; end if;
 select * into v_policy from public.policies where source_id=v_observation.source_id for update;
 if v_policy.catalog_status is distinct from 'ACTIVE' or v_policy.applied_snapshot_id is distinct from v_observation.snapshot_id
  or v_policy.normalized->>'normalizerVersion' is distinct from v_observation.normalizer_version
  or v_policy.normalized->>'displayHash' is distinct from v_observation.display_hash
  or md5(v_policy.normalized::text) is distinct from v_observation.normalized_hash
  or v_observation.evaluator_version is distinct from public.policy_label_version() then raise exception 'STALE_LABEL_REVIEW'; end if;
 if v_policy.applied_snapshot_id::text is distinct from p_payload->>'expectedSnapshotId'
  or v_policy.normalized is distinct from p_payload->'expectedNormalized' then raise exception 'STALE_LABEL_REVIEW'; end if;
 if coalesce(p_payload->>'reviewKey','')='' or coalesce(p_payload->>'reviewer','')='' or coalesce(p_payload->>'reason','')=''
  or coalesce(p_payload->>'reviewKind','') not in ('HUMAN','AI_ASSISTED') then raise exception 'INVALID_LABEL_REVIEW'; end if;
 select * into v_previous from public.policy_label_reviews where review_key=p_payload->>'reviewKey';
 if found then
  if v_previous.observation_id<>v_observation.id or v_previous.assessment is distinct from v_assessment
   or v_previous.reviewer is distinct from p_payload->>'reviewer' or v_previous.review_kind is distinct from p_payload->>'reviewKind'
   or v_previous.reason is distinct from p_payload->>'reason' then raise exception 'LABEL_REVIEW_KEY_CONFLICT'; end if;
  return jsonb_build_object('reviewId',v_previous.id,'replayed',true);
 end if;
 if not (p_payload ? 'expectedReviewId') then raise exception 'LABEL_REVIEW_CONFLICT'; end if;
 insert into public.policy_label_reviews(observation_id,expected_review_id,review_key,reviewer,review_kind,reason,assessment)
 values(v_observation.id,(p_payload->>'expectedReviewId')::bigint,p_payload->>'reviewKey',p_payload->>'reviewer',p_payload->>'reviewKind',p_payload->>'reason',v_assessment) returning id into v_id;
 return jsonb_build_object('reviewId',v_id,'replayed',false);
end $$;
revoke all on function public.policy_review_labels(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.policy_review_labels(jsonb) to service_role;
notify pgrst,'reload schema';
