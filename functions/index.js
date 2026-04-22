const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { setGlobalOptions } = require('firebase-functions/v2');
const Anthropic = require('@anthropic-ai/sdk');
const admin = require('firebase-admin');

setGlobalOptions({ region: 'asia-northeast3' });

admin.initializeApp();

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

const MODEL = 'claude-sonnet-4-6';

const ANALYSIS_PROMPT = `너는 의류 쇼핑몰 및 숏폼 콘텐츠 릴스 스크립트 분석 전문가야.
아래 분석 예시들과 후킹 공식 유형들을 완전히 학습해서 동일한 수준과 방식으로 분석해줘.

=== 핵심 분석 원칙 ===
1. 표면적 설명이 아니라 심리 메커니즘까지 설명해야 해
2. "왜 이 문장이 효과적인가"를 반드시 설명해
3. 후킹 공식은 A/B 구조로 추상화해서 추출해
4. 위 22개 유형에 해당하지 않는 새로운 후킹 패턴 발견 시 새 유형명 자동 생성하고 isNewType: true 표시

=== 후킹 유형 네이밍 규칙 ===

모든 유형명은 반드시 "유형명 : 시청자 속마음" 형식으로:
- 시청자가 그 순간 속으로 하는 말
- 짧고 일상적인 표현 (10자 이내)
- 마케팅 용어 절대 금지
- 물음표나 느낌표 사용 가능

=== 후킹 공식 유형 22개 ===

유형1: 상황제시형 : 어 이거 나 얘기잖아
공식: "나만 입고싶은 A룩 코디"
구조: A = 타겟이 찾는 상황(분위기)
효과: 해당 상황을 찾는 타겟을 즉시 설정. 나만이라는 소유욕 자극.

유형2: 결과제시형 : 이거 하면 나도 될까?
공식: "여러분 저 드디어 찾았어요..! A만해도 B되는 C"
구조: A = 누구든지 쉽게 할 수 있는 행동, B = 타겟의 문제/원하는 결과, C = 상품
효과: 드디어라는 단어로 오랜 탐색 끝 신뢰감 + 결과 수치화로 신뢰도 상승.

유형3: 군중심리형 : 나만 모르고 있었나?
공식: "문의 폭주 언니 이거 뭐예요?"
구조: 현재 시장 반응을 먼저 보여줌
효과: 군중심리 활용. 타겟의 궁금증 유도.

유형4: 브랜드반전형 : 이걸 왜 안 입어?
공식: "저는 A 못 입어요 사실 안입어요 대신 B 이거 입어요 이게뭐냐구요?"
구조: A = 일반적으로 높은 가치를 매기는 브랜드, B = A에 비해 가성비 있는 상품
효과: 예측오류 발생 → 왜 안입지? 궁금증 유발 → 대안 제시.

유형5: 인지부조화형 : 어? 그게 더 좋다고?
공식: "A보다 시원한 B? 진짜? / 여름에 B 덥지 않냐고?"
구조: A = 계절에 맞는 일반적 제품, B = 반전 제품
효과: 인지부조화 유발 → 이게 더 시원하다고? 궁금증 → 기능적 근거로 설득.

유형6: 공감형 : 나만 이런 거 아니었구나
공식: "이거 나만 그래요? 매번 A할 때마다 B"
구조: A = 타겟이 자주 겪는 상황, B = 그 상황에서 겪는 문제
효과: 나만 그래요?라는 표현으로 공감대 형성. 혼자가 아니라는 안도감 유발.

유형7: before/after형 : 입기 전이랑 완전 다르네
공식: "A 전 vs A 후"
구조: A = 제품 착용/사용
효과: 시각적 변화를 직접 보여줘 결과에 대한 기대감 극대화.

유형8: 숫자형 : 이것만 알면 되는 거야?
공식: "딱 N가지만 기억하세요"
구조: N = 3~5개의 핵심 포인트
효과: 숫자로 정보를 구조화해 신뢰도 상승. 끝까지 보게 만드는 유도.

유형9: 금지형 : 나 이거 하고 있었는데?
공식: "절대 이렇게 A하지 마세요"
구조: A = 타겟이 흔히 하는 실수
효과: 금지 표현으로 즉각적 주목. 내가 실수하고 있나? 라는 불안감 유발.

유형10: 질문형 : 나 아직도 이러고 있나?
공식: "아직도 A 하세요?"
구조: A = 타겟의 현재 행동 (개선 가능한 것)
효과: 현재 행동을 문제로 규정해 변화 필요성 인식. 살짝 도발적인 어투로 주목.

유형11: 고백형 : 이 사람 믿을 수 있겠다
공식: "사실 저 A 했어요 (근데 B)"
구조: A = 예상치 못한 솔직한 고백, B = 반전 결과
효과: 솔직함으로 신뢰도 상승. 반전 결과로 궁금증 유발.

유형12: 비교형 : 이게 저것보다 낫다고?
공식: "A vs B, 뭐가 나을까요?"
구조: A = 기존 선택지, B = 새로운 선택지
효과: 선택을 유도해 참여감 형성. 끝까지 보게 만드는 구조.

유형13: 전문가반전형 : 전문가도 이걸 안 해?
공식: "A인 내가 B를 안하는 이유"
구조: A = 해당 분야 전문가 포지션, B = 일반적인 선택지/행동
효과: 전문가가 왜 안해? 라는 역설적 궁금증 유발. 전문가의 반전 행동으로 예측오류 발생.
예시: "의사인 내가 커피를 안마시는 이유" / "100억 번 내가 친구를 안만나는 이유"

유형14: 손실경고형 : 나 지금 잘못하고 있는 건가?
공식: "A 이렇게 하면 B 폭탄 맞습니다"
구조: A = 타겟이 하는 행위, B = 최악의 결과
효과: 내가 잘못하고 있나? 라는 불안감 즉각 유발. 손실 회피 심리 자극.
예시: "해외주식 이렇게 하면 양도소득세 폭탄 맞습니다"

유형15: 쉬운행동+큰결과형 : 이것만 해도 된다고?
공식: "A해도 B는 기본입니다. 이거 모르면 평생 고생"
구조: A = 쉬운 행동, B = 큰 결과
효과: 진입장벽 낮추고 기대값 높이기. 모르면 손해라는 심리 자극.
예시: "살살쳐도 150m는 기본입니다. 이 동작 모르면 평생 고생"

유형16: 비밀공개형 : 이런 게 있었어?
공식: "A가 알리지 말라던 B 공개합니다"
구조: A = 전문가/내부자, B = 타겟이 알고싶은 정보
효과: 희소성 + 특권 의식 자극. 나만 아는 정보라는 기대감 형성.
예시: "고깃집 사장님이 알리지 말라던 된장찌개 비밀 공개합니다"

유형17: 스토리증명형 : 저 사람도 됐으면 나도 되겠다
공식: "A에서 B해 C만에 D한 E"
구조: A = 평범한 장소, B = 쉬운 행동, C = 짧은 기간, D = 큰 성과, E = 의외의 인물
효과: 평범한 사람도 할 수 있다는 희망 + 구체적 수치로 신뢰도 상승.
예시: "집에서 꽃 팔아 5년만에 100평 가게 확장한 40대 주부"

유형18: 버리기형 : 나 이거 잘못 쓰고 있었나?
공식: "이럴거면 그냥 A하세요. B 제대로 쓰는 방법 N가지"
구조: A = 부정적 표현(버리다/포기하다), B = 타겟이 가진 것
효과: 충격적 제안으로 주목. 제대로 알려준다는 기대감 형성.
예시: "이럴거면 그냥 버리세요. 제습기 제대로 쓰는 방법 6가지"

유형19: 절약보장형 : 이렇게 하면 이만큼 아낀다고?
공식: "A 이렇게만 따라하세요. B 아낍니다"
구조: A = 타겟이 하고 싶은 행동, B = 타겟이 아끼고 싶은 노력/비용/시간
효과: 쉽게 따라할 수 있다는 기대감 + 구체적 절약 수치로 신뢰도 상승.
예시: "인테리어 이렇게만 따라하세요. 1000만원 아낍니다"

유형20: 상위%공개형 : 나만 이걸 모르고 있었나?
공식: "A로 B하지 마세요. 상위 0.1%의 A 활용법"
구조: A = 타겟이 사용하는 도구, B = 일반적인 사용법
효과: 일반적 사용법이 잘못됐다는 충격 + 상위% 진입 욕구 자극.
예시: "챗GPT로 검색하지 마세요. 상위 0.1%의 AI 활용법"

유형21: 의외의인물성과형 : 저런 사람도 됐다고?
공식: "A에 B만 달고 C하는 D"
구조: A = 남들이 많이 하는 것, B = 쉬운 행동, C = 좋은 성과, D = 의외의 인물
효과: 나도 할 수 있다는 가능성 + 의외의 인물로 호기심 자극.
예시: "쇼츠에 링크만 달고 월 수천 버는 99년생"

유형22: 발견공유형 : 아는 사람만 안다는 거 나도 알고 싶어
공식: "아는 사람만 골라간다는 A하는 초간단 방법"
구조: A = 타겟이 원하는 목표
효과: 나만 모르고 있었나? 소외감 자극. 초간단이라는 표현으로 진입장벽 낮춤.
예시: "아는 사람만 골라간다는 꿀수박 고르는 초간단 방법"

=== 도입부 구조 유형 ===

분석 시 sentences에서 도입부 문장들에 아래 구조 태그도 같이 표시해줘.

도입부1: 문제→사례→유인
타겟의 문제 제시 → 누구나 겪어봤을 사례 → 해결책 보여준다는 기대감

도입부2: 사례→문제→유인
머릿속에 그려지는 상황 설명 → 해본 사람들은 안다는 공감 유도 → 이뤄질 수 있다는 기대감

도입부3: 하이라이트→유인
영상에서 가장 임팩트 있는 장면을 먼저 보여줌 → 이걸 얻을 수 있다는 기대감

도입부4: 권위→증명→유인
본인 또는 타인의 성과/전문성 보여주기 → 수치나 사례로 증명 → 너도 할 수 있다는 기대감

도입부5: 스토리→실패→반전→유인
목표를 위한 행동과 이유 설명 → 열심히 했지만 실패 → 이걸 알고 나서 달라졌다 → 기대감 형성

=== 분석 예시 ===

예시1 - 연말룩 코디:
"나만 입고싶은 연말룩 코디" → 태그:후킹 / 연말룩이라는 상황 제시로 해당 상황을 찾는 타겟 즉시 설정. 나만이라는 소유욕 자극 표현으로 희소성 인식 유발. 유형1 상황제시형.
"첫번짼, 블랙인데 깔끔하고 단정해서 완내스" → 태그:본문 / 첫번째라는 단어로 이게 한 개가 아님을 상기시켜 끝까지 보게 유도. 장점 설명 + 리액션 구조.
"!!!!! 골반 생기는 스커트 !!!!!" → 태그:본문 / 제품 착용 시 발생하는 이익을 직접 제시. 타겟이 원하는 결과를 느낌표 반복으로 강조.
"따수운데 코디도 돼서 강추" → 태그:본문 / 따뜻하면 코디가 망가진다는 일반적 사고를 깨는 생각 깨기 기술. 예측오류를 통한 신뢰 상승.
"이거 남자친구는 물론이고 길가다가 번호는 3번 따이는 룩" → 태그:심리 / 사회적 증거와 구체적 숫자로 결과 수치화. 타겟이 원하는 사회적 인정 욕구 자극.

예시2 - 살 빠져보이는 팬츠:
"여러분 저 드디어 찾았어요..!" → 태그:후킹 / 드디어라는 단어로 오랜 탐색 끝에 발견했다는 신뢰감 형성. 흥미 유발.
"입기만 해도 -3KG 되는 팬츠" → 태그:후킹 / 타겟이 기대하는 결과를 숫자로 수치화해 신뢰도 상승. 결과 제시형 후킹. 유형2.
"입고다니면 다 정보 물어보고, 심지어 직장 동료들도 물어봤어요" → 태그:심리 / 경험 공유로 군중심리 활용. 직장 동료라는 구체적 상황으로 신뢰 극대화.
"이렇게 부들, 모찌, 찰랑거리는 재질에" → 태그:본문 / 촉각/청각적 표현으로 제품 장점 감각화. 직접 만져보지 않아도 느낌이 전달되는 효과.
"마감도 이렇게 고급스러운데 3만원대" → 태그:본문 / 가격 반전. 고급스러움이라는 기대값을 먼저 높인 뒤 저렴한 가격으로 충격 유발.
"기모버전엔 두툼한 밍크기모까지" → 태그:본문 / 상품의 다양한 옵션 제시로 선택지 다양화. 1개 사려던 사람도 2개 고민하게 만드는 기술.

예시3 - 주문 폭주 셔츠:
"문의 폭주 / 언니 이거 뭐에요???" → 태그:후킹 / 현재 제품이 가지는 시장 반응을 먼저 보여줌. 군중심리 활용한 상품 소개. 유형3 군중심리형.
"주말 아울렛 사진 올렸다가 상품문의 폭주한 이셔츠!!" → 태그:본문 / 상품 소개를 위한 밑밥깔기. 일상적 상황에서 자연스럽게 노출된 것처럼 연출해 신뢰도 상승.
"저는 목이 짧아서 타이는 그냥 안했구요" → 태그:심리 / 솔직함 어필로 신뢰도 상승. 단점을 먼저 인정하는 역설적 신뢰 전략.
"코디 고민없고 완전 날씬해보여요!" → 태그:본문 / 제품 사용 후 얻을 수 있는 결과. 타겟이 원하는 결과 직접 제시.

예시4 - 룰루레몬 대신 레깅스:
"여러분! 저는 룰루레몬, 알로 못 입어요! 사실 안입어요" → 태그:후킹 / 룰루레몬/알로는 MZ들이 선망하는 고가 요가복 브랜드. 이 브랜드를 못 입는다는 예측오류 발생 → 왜 안입지? 궁금증 유발. 유형4 브랜드반전형.
"대신 이거 입어요 / 이게 뭐냐구요?" → 태그:후킹 / 타겟에게 새로운 방법 제시. 궁금증 극대화.
"알로 반의 반값으로 살 수 있어요!" → 태그:본문 / 앞서 언급한 고가 브랜드 대비 가격 비교로 가성비 극대화. 가격 반전 후킹.
"이건 레깅스 핏에서 중요한건데" → 태그:심리 / ~~은 중요하다는 표현으로 시청자가 생각도 못했던 것을 생각하게 만드는 화법. 제품 가치 불어넣기.
"궁뎅이 눌림 아예 없어요 / 열심히 만든 궁댕이 눌려버리면 화나" → 태그:심리 / 일반적으로 이 상품 착용 시 발생하는 문제 공유. 공감대 자극.
"아!! 참 이거 베이지랑 블랙도 있어요" → 태그:본문 / 선택지 다양화. 1개 사려던 사람도 2장 생각하게 만드는 기술. 갑작스런 정보 추가로 재집중 유도.
"이거 2월까지만 할인들어가니까" → 태그:CTA / 한정 기간으로 구매 긴박감 조성. 기간 명시로 실행력 높임.

예시5 - 샤스커트:
"아직도 그냥 스커트 입으세요?" → 태그:후킹 / 문제제기 + 질문 형식. 현재 타겟의 행동을 문제로 규정해 변화 필요성 인식. 유형10 질문형.
"이런 치마 입고싶은데 너무 공주 느낌 날까봐 망설이셨죠?" → 태그:심리 / 타겟이 실제로 겪는 망설임을 대신 말해줌. 공감대 형성으로 신뢰 상승.
"하나로 두가지 분위기가 가능해요" → 태그:본문 / 제품 활용도를 수치화(2가지). 가성비 인식 상승.
"심지어 가격도 만원대레요" → 태그:본문 / 심지어라는 접속사로 가격 반전 극대화. 앞서 쌓인 기대값 대비 충격 유발.

예시6 - 여름 긴바지:
"반바지보다 시원한 긴바지? 진짜?" → 태그:후킹 / 계절에 맞는 일반적 제품(반바지) 대비 반전 제품(긴바지) 제시. 인지부조화 유발. 유형5 인지부조화형.
"여름에 긴바지 덥지 않냐고?" → 태그:심리 / 시청자가 당연히 가질 반론을 먼저 선제적으로 꺼냄. 감성이 아닌 논리로 설득하는 기술.
"퀄리티 좋은 드라이 나일론 원단으로 제작해서 통풍 잘 돼서 시원하고" → 태그:본문 / 반론에 대한 기능적 근거 제시. 소재명/기능을 구체적으로 설명하는 설득 방식.
"다리에 땀 차도 땀이 안붙어서 나처럼 땀 많은 사람도" → 태그:심리 / 보통 긴바지를 여름에 입었을 때 생기는 문제 걱정 해결. 나처럼이라는 표현으로 공감대 형성.
"내가 코디를 못한다? 걱정마 누가 입어도 무조건 기본 이상을 하니까" → 태그:본문 / 핵심 고민(코디 못함) 직접 공략. 걱정마라는 단호한 확신형 어투.
"이 바지 한 장 사면 19,800원인데 두 장 사면 추가 할인까지 더해서 34,800원" → 태그:본문 / 가격을 수치로 직접 비교. 더 큰 할인으로 구매 안하면 손해본다는 심리 자극.

=== AI 자동 유형 생성 규칙 ===
위 22개 유형에 해당하지 않는 새로운 후킹 패턴 발견 시:
- hookFormulaType에 새로운 유형명 자동 생성 — 반드시 "유형명 : 시청자 속마음" 형식 유지
- 시청자가 그 순간 속으로 하는 말로 네이밍, 마케팅 용어 절대 금지
- hookFormulaDesc에 공식 구조와 효과 설명 포함
- isNewType: true 표시

새 유형 예시:
한정수량형 : 나 놓치면 안 되는 거 아닌가?
안도감유발형 : 아직 늦지 않았어
역설적신뢰형 : 솔직히 말해주는 사람이네
불안감자극형 : 혹시 나만 모르나?
반성유도형 : 나 이거 잘못하고 있었나?

=== 응답 형식 (반드시 JSON만) ===
{
  "needsContext": ["맥락이 필요한 단어들 — 없으면 빈 배열"],
  "hookFormula": "추출된 후킹 공식",
  "hookFormulaType": "유형명 : 시청자 속마음 (예: 브랜드반전형 : 이걸 왜 안 입어?)",
  "hookFormulaDesc": "공식 구조 설명 (A=?, B=? 형태로)",
  "isNewType": false,
  "introStructure": "도입부1~5 중 해당하는 것 — 없으면 null",
  "sentences": [
    {
      "text": "문장",
      "tag": "후킹|본문|심리|CTA",
      "effect": "심리 메커니즘까지 포함한 효과 설명"
    }
  ]
}`;

const DRAFT_SYSTEM_PROMPT = `너는 의류 쇼핑몰 릴스 스크립트 작성 전문가야.
레퍼런스 분석에서 추출된 후킹 공식과 구조를 기반으로
입력된 상품에 맞는 스크립트 초안을 작성해줘.

반드시 JSON으로만 응답:
{
  "hook": "후킹 문구",
  "body": "본문 내용",
  "cta": "CTA 문구"
}`;

const CONTEXT_OPTIONS_PROMPT = `너는 릴스 대본 분석 전문가야.
아래 전체 대본을 보고, 특정 단어가 이 영상에서 어떤 의미/맥락으로 사용됐는지 가능한 해석 4가지를 생성해줘.

각 선택지:
- label: 해석 설명 (15자 이내, 쉬운 말로 — 어려운 마케팅 용어 사용 금지)
- effect: 이 맥락으로 해석할 때 릴스 분석에 미치는 영향 (1~2문장, 쉬운 말로)

반드시 JSON으로만 반환:
{
  "options": [
    { "label": "선택지 설명", "effect": "이 맥락으로 해석하면 분석에 미치는 영향" }
  ]
}`;

const UPDATE_SENTENCES_PROMPT = `너는 릴스 대본 분석 전문가야.
아래 단어들의 맥락 정보가 추가됐어.
이 맥락을 반영해서 해당 문장들의 분석을 더 정확하고 깊게 업데이트해줘.

기존 분석에서 이 단어가 포함된 문장들만 찾아서
맥락을 반영한 더 깊은 분석으로 교체해줘.

반드시 JSON으로만 반환:
{
  "updates": [
    { "text": "문장 원문 (그대로)", "effect": "맥락 반영된 새 분석" }
  ]
}`;

const REFINE_SENTENCE_PROMPT = `아래 문장에 대한 기존 분석이 있어.
사용자가 피드백을 줬는데 이 피드백을 반영해서 분석을 수정해줘.

수정된 분석만 JSON으로 반환:
{ "effect": "수정된 분석 내용" }`;

const REFINE_ANALYSIS_PROMPT = `아래는 릴스 대본의 전체 분석 결과야.
사용자가 전체 분석에 대한 피드백을 줬어. 이 피드백을 반영해서 전체 분석을 수정해줘.

수정된 전체 분석만 JSON으로 반환:
{
  "hookFormula": "공식",
  "hookFormulaType": "유형명 : 시청자 속마음 (예: 브랜드반전형 : 이걸 왜 안 입어?)",
  "hookFormulaDesc": "공식 구조 설명 (A=?, B=? 형태로)",
  "isNewType": false,
  "introStructure": "도입부1~5 중 해당하는 것 또는 null",
  "sentences": [
    { "text": "문장", "tag": "후킹|본문|심리|CTA", "effect": "심리 효과 설명" }
  ]
}`;

function parseJsonFromText(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('응답 파싱 실패');
  return JSON.parse(match[0]);
}

exports.analyzeScript = onCall(
  { secrets: [anthropicApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const { text } = request.data;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new HttpsError('invalid-argument', '분석할 대본 텍스트를 입력해주세요.');
    }
    if (text.trim().length > 5000) {
      throw new HttpsError('invalid-argument', '대본은 5000자 이하로 입력해주세요.');
    }

    const client = new Anthropic({ apiKey: anthropicApiKey.value() });

    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: ANALYSIS_PROMPT,
        messages: [{ role: 'user', content: `대본:\n${text.trim()}` }],
      });
      const result = parseJsonFromText(message.content[0].text);

      const { needsContext: _nc, ...analysisData } = result;
      const contextWords = Array.isArray(result.needsContext) ? result.needsContext : [];
      if (contextWords.length > 0) {
        return { success: true, needsContext: true, words: contextWords, data: analysisData };
      }
      return { success: true, needsContext: false, data: analysisData };
    } catch (e) {
      console.error('analyzeScript error:', e);
      if (e instanceof HttpsError) throw e;
      throw new HttpsError('internal', 'AI 분석 중 오류가 발생했습니다.');
    }
  }
);

exports.generateContextOptions = onCall(
  { secrets: [anthropicApiKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    const { word, sentence, fullScript } = request.data;
    if (!word || !sentence) throw new HttpsError('invalid-argument', '단어와 문장이 필요합니다.');

    const client = new Anthropic({ apiKey: anthropicApiKey.value() });
    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: CONTEXT_OPTIONS_PROMPT,
        messages: [{
          role: 'user',
          content: `전체 대본:\n${(fullScript || sentence).trim()}\n\n이 문장: ${sentence}\n단어: ${word}`,
        }],
      });
      const result = parseJsonFromText(message.content[0].text);
      return { success: true, data: result };
    } catch (e) {
      console.error('generateContextOptions error:', e);
      if (e instanceof HttpsError) throw e;
      throw new HttpsError('internal', '선택지 생성 중 오류가 발생했습니다.');
    }
  }
);

exports.updateSentencesWithContext = onCall(
  { secrets: [anthropicApiKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    const { sentences, contextMap } = request.data;
    if (!sentences || !contextMap) throw new HttpsError('invalid-argument', '필수 값이 누락됐습니다.');

    const client = new Anthropic({ apiKey: anthropicApiKey.value() });
    const contextStr = Object.entries(contextMap)
      .map(([word, label]) => `- ${word}: ${label}`)
      .join('\n');
    const sentencesStr = sentences
      .map((s) => `[${s.tag}] ${s.text} → ${s.effect}`)
      .join('\n');

    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: UPDATE_SENTENCES_PROMPT,
        messages: [{
          role: 'user',
          content: `맥락 정보:\n${contextStr}\n\n기존 문장별 분석:\n${sentencesStr}`,
        }],
      });
      const result = parseJsonFromText(message.content[0].text);
      return { success: true, data: result };
    } catch (e) {
      console.error('updateSentencesWithContext error:', e);
      if (e instanceof HttpsError) throw e;
      throw new HttpsError('internal', '맥락 반영 중 오류가 발생했습니다.');
    }
  }
);

exports.refineSentence = onCall(
  { secrets: [anthropicApiKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    const { text, effect, feedback } = request.data;
    if (!text || !effect || !feedback) {
      throw new HttpsError('invalid-argument', '필수 값이 누락됐습니다.');
    }

    const client = new Anthropic({ apiKey: anthropicApiKey.value() });
    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 512,
        system: REFINE_SENTENCE_PROMPT,
        messages: [{
          role: 'user',
          content: `문장: ${text}\n기존 분석: ${effect}\n사용자 피드백: ${feedback}`,
        }],
      });
      const result = parseJsonFromText(message.content[0].text);
      return { success: true, data: result };
    } catch (e) {
      console.error('refineSentence error:', e);
      if (e instanceof HttpsError) throw e;
      throw new HttpsError('internal', '분석 수정 중 오류가 발생했습니다.');
    }
  }
);

exports.refineAnalysis = onCall(
  { secrets: [anthropicApiKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    const { sentences, hookFormula, hookFormulaDesc, feedback } = request.data;
    if (!sentences || !hookFormula || !feedback) {
      throw new HttpsError('invalid-argument', '필수 값이 누락됐습니다.');
    }

    const client = new Anthropic({ apiKey: anthropicApiKey.value() });
    const sentenceSummary = sentences
      .map((s) => `[${s.tag}] ${s.text} → ${s.effect}`)
      .join('\n');

    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: REFINE_ANALYSIS_PROMPT,
        messages: [{
          role: 'user',
          content: `후킹 공식: ${hookFormula}\n공식 설명: ${hookFormulaDesc || ''}\n\n문장별 분석:\n${sentenceSummary}\n\n사용자 피드백: ${feedback}`,
        }],
      });
      const result = parseJsonFromText(message.content[0].text);
      return { success: true, data: result };
    } catch (e) {
      console.error('refineAnalysis error:', e);
      if (e instanceof HttpsError) throw e;
      throw new HttpsError('internal', '전체 분석 수정 중 오류가 발생했습니다.');
    }
  }
);

const GENERATE_TEMPLATE_PROMPT = `아래 릴스 대본을 분석해서 세 가지를 추출해줘.

분석 순서:

1단계: 후킹 유형 파악
아래 22개 유형 중 이 대본의 후킹이 어떤 유형인지 먼저 파악해.
22개 유형에 해당하지 않으면 새로운 유형명을 직접 만들고 isNewType: true 표시.
반드시 전체 대본을 처음부터 끝까지 읽고 앞 문장만 보고 결론 내지 말 것.

유형1: 상황제시형 : 어 이거 나 얘기잖아 - 타겟이 찾는 상황/분위기로 후킹
유형2: 결과제시형 : 이거 하면 나도 될까? - A만 해도 B되는 C 구조
유형3: 군중심리형 : 나만 모르고 있었나? - 시장 반응을 먼저 보여줌
유형4: 브랜드반전형 : 이걸 왜 안 입어? - 저는 A 못 입어요 사실 안입어요 → 예측오류 발생, 왜 안입지? 궁금증 유발, 전체 맥락 보면 가성비 대안 제시 구조
유형5: 인지부조화형 : 어? 그게 더 좋다고? - A보다 B한 C? 진짜? → 상식을 뒤집는 의문형
유형6: 공감형 : 나만 이런 거 아니었구나 - 이거 나만 그래요? 타겟 공감대 형성
유형7: before/after형 : 입기 전이랑 완전 다르네 - 착용 전후 비교
유형8: 숫자형 : 이것만 알면 되는 거야? - 딱 N가지만 기억하세요
유형9: 금지형 : 나 이거 하고 있었는데? - 절대 이렇게 하지 마세요
유형10: 질문형 : 나 아직도 이러고 있나? - 아직도 A 하세요?
유형11: 고백형 : 이 사람 믿을 수 있겠다 - 사실 저 A 했어요 근데 B
유형12: 비교형 : 이게 저것보다 낫다고? - A vs B 뭐가 나을까요?
유형13: 전문가반전형 : 전문가도 이걸 안 해? - A인 내가 B를 안하는 이유
유형14: 손실경고형 : 나 지금 잘못하고 있는 건가? - A 이렇게 하면 B 폭탄 맞습니다
유형15: 쉬운행동+큰결과형 : 이것만 해도 된다고? - A해도 B는 기본입니다
유형16: 비밀공개형 : 이런 게 있었어? - A가 알리지 말라던 B 공개합니다
유형17: 스토리증명형 : 저 사람도 됐으면 나도 되겠다 - A에서 B해 C만에 D한 E
유형18: 버리기형 : 나 이거 잘못 쓰고 있었나? - 이럴거면 그냥 버리세요
유형19: 절약보장형 : 이렇게 하면 이만큼 아낀다고? - A 이렇게만 따라하세요 B 아낍니다
유형20: 상위%공개형 : 나만 이걸 모르고 있었나? - A로 B하지 마세요 상위 0.1%의 활용법
유형21: 의외의인물성과형 : 저런 사람도 됐다고? - A에 B만 달고 C하는 D
유형22: 발견공유형 : 아는 사람만 안다는 거 나도 알고 싶어 - 아는 사람만 골라간다는 A하는 초간단 방법

2단계: 공감 포인트 추출
파악한 후킹 유형이 시청자에게 주는 심리적 효과를 분석해.
반드시 전체 대본 흐름을 처음부터 끝까지 읽고 판단해.
앞 문장만 보고 결론 내지 말고 반드시 전체 맥락으로 판단해.

예시 (유형4 브랜드반전형):
앞부분만 보면 '비싸서 못 산다'처럼 보이지만
전체를 보면 '선망하는 브랜드인데 안 입는다는 예측오류로 호기심 유발
→ 왜 안 입지? 라는 궁금증이 끝까지 보게 만들고
→ 알고보니 더 좋은 가성비 대안이 있었다는 구조'

3단계: 스크립트 템플릿 생성
대본의 구조와 흐름을 유지하면서
핵심 키워드들을 [대체할 내용 힌트] 형태의 빈칸으로 변환.
빈칸은 사용자가 자신의 상품/브랜드로 채워넣을 수 있게
힌트를 명확하고 쉽게 써줘.

4단계: 공감의 결 키워드 추출
이 대본이 시청자의 어떤 심리/감정을 건드리는지 핵심 키워드 3~5개를 추출해.
짧고 직관적인 단어로.
(예: 가성비, 예측오류, 군중심리, 전문가신뢰, 사회적증거, 변신욕구, 소유욕, 공감대, 희소성, 손실회피)

22개에 해당하지 않는 새 유형 발견 시:
- 반드시 "유형명 : 시청자 속마음" 형식 유지
- 시청자가 그 순간 속으로 하는 말로 네이밍, 마케팅 용어 절대 금지
- isNewType: true 표시

반드시 JSON만 반환:
{
  "hookType": "유형명 : 시청자 속마음 (예: 브랜드반전형 : 이걸 왜 안 입어?)",
  "isNewType": false,
  "empathyPoint": "후킹 유형 기반으로 분석한 공감 포인트 (2~3줄)",
  "empathyTags": ["키워드1", "키워드2", "키워드3"],
  "template": "빈칸이 포함된 템플릿 대본 (줄바꿈 포함)"
}`;

exports.generateTemplate = onCall(
  { secrets: [anthropicApiKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

    const { script } = request.data;
    if (!script || typeof script !== 'string' || script.trim().length === 0) {
      throw new HttpsError('invalid-argument', '대본을 입력해주세요.');
    }
    if (script.trim().length > 5000) {
      throw new HttpsError('invalid-argument', '대본은 5000자 이하로 입력해주세요.');
    }

    const client = new Anthropic({ apiKey: anthropicApiKey.value() });
    const db = admin.firestore();

    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: GENERATE_TEMPLATE_PROMPT,
        messages: [{ role: 'user', content: `대본:\n${script.trim()}` }],
      });
      const result = parseJsonFromText(message.content[0].text);

      if (result.isNewType && result.hookType) {
        const existing = await db.collection('newHookTypes')
          .where('hookType', '==', result.hookType)
          .limit(1)
          .get();

        if (existing.empty) {
          await db.collection('newHookTypes').add({
            hookType: result.hookType,
            scriptExample: script.trim(),
            discoveredAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      return { success: true, data: result };
    } catch (e) {
      console.error('generateTemplate error:', e);
      if (e instanceof HttpsError) throw e;
      throw new HttpsError('internal', '템플릿 생성 중 오류가 발생했습니다.');
    }
  }
);

exports.generateScript = onCall(
  { secrets: [anthropicApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const { productName, features, analysis } = request.data;

    if (!productName || typeof productName !== 'string' || productName.trim().length === 0) {
      throw new HttpsError('invalid-argument', '상품명을 입력해주세요.');
    }
    if (!analysis || !analysis.hookFormula) {
      throw new HttpsError('invalid-argument', '레퍼런스 분석 결과가 필요합니다.');
    }

    const client = new Anthropic({ apiKey: anthropicApiKey.value() });
    const sentenceSummary = (analysis.sentences || [])
      .map((s) => `[${s.tag}] ${s.text}`)
      .join('\n');

    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: DRAFT_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `상품명: ${productName.trim()}
핵심 특징: ${(features || '').trim()}

추출된 후킹 공식: ${analysis.hookFormula}
공식 설명: ${analysis.hookFormulaDesc || ''}
참고 문장 구조:
${sentenceSummary}`,
        }],
      });
      const result = parseJsonFromText(message.content[0].text);
      return { success: true, data: result };
    } catch (e) {
      console.error('generateScript error:', e);
      if (e instanceof HttpsError) throw e;
      throw new HttpsError('internal', '스크립트 생성 중 오류가 발생했습니다.');
    }
  }
);
