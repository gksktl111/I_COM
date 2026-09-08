"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Gavel,
  MessageSquare,
  Search,
  Send,
  ShieldCheck,
  SpellCheck,
  UserRound,
  UserRoundX,
} from "lucide-react";
import { EyeOff, FilePlus2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { PageHeading } from "./AdminPrimitives";
import "./community-console.css";

const tabs = [
  { id: "reports", label: "신고 접수 내역" },
  { id: "posts", label: "전체 게시글 모니터링" },
  { id: "comments", label: "댓글 모니터링" },
  { id: "words", label: "금칙어 및 필터링 사전" },
];
const columns: Record<string, string[]> = {
  reports: [
    "신고 ID",
    "구분",
    "신고 사유 / 원본 요약",
    "작성자",
    "신고자",
    "접수 일시",
    "상태",
    "조치",
  ],
  posts: [
    "게시글 ID",
    "게시판",
    "게시글 제목 / 본문 요약",
    "작성자",
    "작성 일시",
    "공개 상태",
    "조치",
  ],
  comments: [
    "댓글 ID",
    "원본 게시글",
    "댓글 내용",
    "작성자",
    "작성 일시",
    "공개 상태",
    "조치",
  ],
  words: ["금칙어", "분류", "필터링 방식", "등록 일시", "사용 상태", "관리"],
};
export function CommunityConsole({ initialTab }: { initialTab?: string }) {
  const tab = tabs.some((item) => item.id === initialTab)
    ? initialTab!
    : "reports";
  const [period, setPeriod] = useState("7d");
  const [calendar, setCalendar] = useState(false);
  const [searched, setSearched] = useState(false);
  const [guide, setGuide] = useState(false);
  const reports = tab === "reports";
  const words = tab === "words";
  const title = reports
    ? "신고 목록"
    : words
      ? "금칙어 목록"
      : tab === "posts"
        ? "게시글 목록"
        : "댓글 목록";
  return (
    <div className="community-console">
      <PageHeading
        title="커뮤니티·신고 관리"
        description="육아 소통 커뮤니티 게시글·댓글 모니터링 및 이용자 신고 처리"
        action={
          <>
            <Link
              className="admin-button admin-button-secondary"
              href="/admin/community?tab=words"
            >
              <SpellCheck size={16} />
              금칙어 관리 설정
            </Link>
            <button
              className="admin-button community-danger-outline"
              disabled
              title="신고·제재 기능 연결 후 사용할 수 있습니다"
            >
              <Gavel size={16} />
              악성 유저 일괄 제재
            </button>
          </>
        }
      />
      <div className="community-metrics">
        {[
          {
            label: "미처리 신고 접수 건수",
            icon: AlertCircle,
            tone: "red",
            detail: "신고 접수 연동 대기",
          },
          {
            label: "오늘 등록된 신규 게시글",
            icon: FilePlus2,
            tone: "teal",
            detail: "게시글 집계 연동 대기",
          },
          {
            label: "누적 블라인드 처리",
            icon: EyeOff,
            tone: "slate",
            detail: "게시글·댓글 조치 연동 대기",
          },
          {
            label: "일시 이용제재 회원",
            icon: UserRoundX,
            tone: "amber",
            detail: "이용 제한 집계 연동 대기",
          },
        ].map(({ label, icon: Icon, tone, detail }) => (
          <article className={`community-metric community-${tone}`} key={label}>
            <div>
              <h2>{label}</h2>
              <span>
                <Icon size={19} aria-hidden="true" />
              </span>
            </div>
            <div>
              <strong aria-label="집계 미연동">—</strong>
              <small>{detail}</small>
            </div>
          </article>
        ))}
      </div>
      <div className="community-tabbar">
        <nav aria-label="커뮤니티 관리 메뉴">
          {tabs.map((item) => (
            <Link
              href={`/admin/community?tab=${item.id}`}
              key={item.id}
              aria-current={tab === item.id ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <span className="community-connection">
          <span />
          데이터 연동 준비 중
        </span>
      </div>
      <form
        className="community-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setSearched(true);
        }}
      >
        <label className="admin-field">
          {reports ? "신고 유형" : words ? "금칙어 분류" : "게시판"}
          <Select
            name="category"
            aria-label={
              reports ? "신고 유형" : words ? "금칙어 분류" : "게시판"
            }
          >
            <option value="all">{reports ? "전체 유형" : "전체 분류"}</option>
            {(reports
              ? [
                  "광고/도배/영리목적",
                  "비방/욕설/인신공격",
                  "허위정보/사기 의심",
                  "음란/청소년 유해",
                  "기타 분쟁",
                ]
              : words
                ? ["광고·홍보", "욕설·비방", "개인정보"]
                : [
                    "정책 신청 후기",
                    "서류·자격 질문",
                    "우리 동네 혜택 톡",
                    "어린이집·돌봄 정보",
                    "자유 토크",
                  ]
            ).map((v) => (
              <option key={v}>{v}</option>
            ))}
          </Select>
        </label>
        <label className="admin-field">
          {reports ? "처리 상태" : words ? "사용 상태" : "공개 상태"}
          <Select
            name="status"
            aria-label={
              reports ? "처리 상태" : words ? "사용 상태" : "공개 상태"
            }
          >
            <option value="all">전체 상태</option>
            {(reports
              ? ["미처리", "검토중", "블라인드 완료", "무혐의/기각"]
              : words
                ? ["사용", "중지"]
                : ["공개", "블라인드"]
            ).map((v) => (
              <option key={v}>{v}</option>
            ))}
          </Select>
        </label>
        <fieldset className="community-period">
          <legend>{reports ? "신고 접수일자 기간" : "등록일자 기간"}</legend>
          <div>
            {[
              { id: "7d", label: "최근 7일" },
              { id: "month", label: "이번달" },
            ].map((item) => (
              <button
                type="button"
                key={item.id}
                aria-pressed={period === item.id && !calendar}
                onClick={() => {
                  setPeriod(item.id);
                  setCalendar(false);
                }}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              aria-label="직접 기간 선택"
              aria-expanded={calendar}
              onClick={() => setCalendar(!calendar)}
            >
              <CalendarDays size={17} />
            </button>
          </div>
          {calendar && (
            <div className="community-date-range">
              <input aria-label="시작일" type="date" name="from" />
              <input aria-label="종료일" type="date" name="to" />
            </div>
          )}
        </fieldset>
        <label className="admin-field">
          검색
          <div className="community-search">
            <Search size={17} aria-hidden="true" />
            <input
              name="q"
              placeholder={
                words ? "금칙어 검색" : "작성자 닉네임, 신고자, 키워드 검색"
              }
              maxLength={100}
            />
            <button type="submit" aria-label="검색 실행">
              <ChevronRight size={18} />
            </button>
          </div>
        </label>
      </form>
      <div className="community-workspace">
        <section className="community-list" aria-label={title}>
          <div className="community-list-heading">
            <div>
              <h2>{title}</h2>
              <span>조회 데이터 미연동</span>
            </div>
            <button type="button" disabled>
              <Download size={16} />
              엑셀 다운로드
            </button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" disabled aria-label="전체 선택" />
                  </th>
                  {columns[tab].map((name) => (
                    <th scope="col" key={name}>
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody />
            </table>
          </div>
          <div className="community-empty" role="status">
            <MessageSquare size={28} aria-hidden="true" />
            <h3>
              {searched
                ? "검색할 데이터가 아직 연결되지 않았습니다"
                : `${title}을 연결할 준비 중입니다`}
            </h3>
            <p>
              {words
                ? "금칙어 저장·필터링 기능 연결 후 등록된 단어가 표시됩니다."
                : "게시글·댓글·신고 저장 기능 연결 후 실제 내역이 표시됩니다."}
            </p>
          </div>
          <div className="community-pagination">
            <span>데이터 연결 후 목록을 확인할 수 있습니다</span>
            <nav aria-label="목록 페이지">
              <button disabled aria-label="이전 페이지">
                <ChevronLeft size={17} />
              </button>
              <button
                disabled
                aria-label="현재 페이지 1"
                className="is-current"
              >
                1
              </button>
              <button disabled aria-label="다음 페이지">
                <ChevronRight size={17} />
              </button>
            </nav>
          </div>
        </section>
        <aside
          className="community-detail"
          aria-label={words ? "금칙어 설정" : "상세 및 제재 조치"}
        >
          <h2>
            <span />
            {words
              ? "금칙어 및 필터링 설정"
              : reports
                ? "신고 상세 및 제재 조치"
                : `${tab === "posts" ? "게시글" : "댓글"} 상세 및 관리`}
          </h2>
          <div className="community-case">
            <span className="admin-badge admin-badge-neutral">
              {words ? "단어 선택 대기" : "내역 선택 대기"}
            </span>
            <h3>
              {words
                ? "등록된 금칙어를 선택해주세요"
                : "목록에서 확인할 내역을 선택해주세요"}
            </h3>
            <p>
              {words
                ? "단어·분류·필터링 방식을 확인합니다."
                : reports
                  ? "신고 사유와 원본 내용을 함께 확인합니다."
                  : "원문과 작성자 정보를 함께 확인합니다."}
            </p>
          </div>
          {reports && (
            <div className="community-report-reason">
              <h3>
                <AlertCircle size={14} aria-hidden="true" />
                신고자 접수 사유
              </h3>
              <p>신고 내역을 선택하면 접수 사유와 신고자 정보가 표시됩니다.</p>
            </div>
          )}
          <div className="community-original">
            <h3>{words ? "필터링 적용 범위" : "게시글·댓글 본문 원문 확인"}</h3>
            <div>
              {words
                ? "등록된 규칙을 선택하면 적용 범위가 표시됩니다."
                : "선택한 내역의 원문이 이곳에 표시됩니다."}
            </div>
          </div>
          <div className="community-author">
            <UserRound size={23} aria-hidden="true" />
            <div>
              <strong>{words ? "등록 정보" : "작성자 정보"}</strong>
              <p>
                {words
                  ? "등록자와 수정 이력 확인"
                  : "가입일·작성글·신고 이력 확인"}
              </p>
            </div>
          </div>
          <fieldset className="community-actions" disabled>
            <legend>{words ? "필터링 설정" : "신속 조치 선택"}</legend>
            <div className="community-quick-actions">
              <button type="button">
                <EyeOff size={16} />
                {words ? "사용 중지" : "즉시 블라인드"}
              </button>
              <button type="button">
                <CheckCircle2 size={16} />
                {words ? "사용 설정" : reports ? "무혐의 종결" : "공개 복원"}
              </button>
            </div>
            <label className="admin-field">
              {words ? "필터링 방식" : "작성자 이용 제한 (제재 조치)"}
              <Select
                disabled
                aria-label={words ? "필터링 방식" : "작성자 이용 제한"}
              >
                <option>
                  {words
                    ? "등록 기능 연결 후 설정 가능"
                    : "제재 없음 (게시글만 조치)"}
                </option>
              </Select>
            </label>
            <label className="admin-field">
              {words
                ? "설정 사유"
                : "조치 사유 입력 (이용자 통보용 알림 메시지)"}
              <textarea
                rows={4}
                placeholder="처리할 내역을 선택하면 입력할 수 있습니다."
              />
            </label>
            <button type="button" className="admin-button community-confirm">
              <Send size={16} />
              {words ? "필터링 설정 저장" : "조치 확정 및 알림 발송"}
            </button>
          </fieldset>
          <button
            type="button"
            className="community-help"
            onClick={() => setGuide(true)}
          >
            <ShieldCheck size={14} />
            이용 및 처리 안내
          </button>
        </aside>
      </div>
      <Dialog
        open={guide}
        onClose={() => setGuide(false)}
        title="커뮤니티 관리 안내"
      >
        <p className="text-sm leading-7">
          현재 게시글·댓글·신고 및 제재 기능은 연결 준비 중입니다. 실제 내역을
          조회하거나 블라인드·회원 제재·알림 발송을 실행하지 않습니다. 데이터가
          연결되면 선택한 내역의 원문과 신고 근거를 확인한 뒤 처리할 수
          있습니다.
        </p>
      </Dialog>
    </div>
  );
}
