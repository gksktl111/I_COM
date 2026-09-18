"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  MessageCircle,
  PenLine,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/common/Footer";

const categories = [
  "전체 보기",
  "정책 신청 후기",
  "서류·자격 질문",
  "우리 동네 혜택 톡",
  "어린이집·돌봄 정보",
  "자유 토크",
];
export function Community() {
  const [category, setCategory] = useState(categories[0]);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [writeOpen, setWriteOpen] = useState(false);
  return (
    <>
      <main
        id="main-content"
        className="page-container py-10 sm:py-12 md:py-16"
      >
        <div className="mb-8 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-primary inline-flex items-center gap-2 text-sm font-semibold">
                <MessageCircle aria-hidden="true" className="size-4" />
                아이콤 정책 사랑방
              </span>
              <Badge variant="secondary">준비 중</Badge>
            </div>
            <h1 className="text-[1.75rem] leading-[1.4] font-semibold tracking-[-0.01em] sm:text-[2rem] sm:font-bold sm:tracking-[-0.02em]">
              육아·정책 소통 커뮤니티
            </h1>
            <p className="text-muted-foreground mt-3 max-w-2xl text-base leading-relaxed">
              신청 경험과 서류 준비 노하우, 우리 동네의 육아 이야기를 안전하게
              나눌 공간을 준비하고 있습니다.
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full whitespace-normal sm:w-auto"
            onClick={() => setWriteOpen(true)}
          >
            <PenLine />
            작성 기능 안내
          </Button>
        </div>
        <div
          className="mb-6 flex gap-2 overflow-x-auto pb-1"
          aria-label="게시글 분류"
        >
          {categories.map((item) => (
            <Chip
              key={item}
              selected={category === item}
              className="shrink-0"
              onClick={() => setCategory(item)}
            >
              {item}
            </Chip>
          ))}
        </div>
        <Notice className="mb-7" role="status">
          <strong className="text-foreground block">기능 상태 · 준비 중</strong>
          게시글 저장, 댓글, 회원 로그인은 아직 연결되지 않았습니다. 현재는
          게시글 분류와 검색 화면만 미리 확인할 수 있습니다.
        </Notice>
        <Card className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 min-[360px]:px-5 sm:px-6">
            <h2 className="text-lg leading-relaxed font-semibold break-words">
              {category}{" "}
              <span className="text-muted-foreground ml-1 text-sm font-normal tabular-nums">
                0건
              </span>
            </h2>
            <span className="text-muted-foreground text-sm">
              게시글 기능 준비 중
            </span>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSubmittedQuery(query.trim());
            }}
            className="mx-auto max-w-2xl border-b px-4 py-5 min-[360px]:px-5 sm:px-6"
          >
            <label htmlFor="community-search" className="text-sm font-semibold">
              게시글 검색
            </label>
            <div className="mt-2 flex flex-col gap-2 min-[360px]:flex-row">
              <Input
                id="community-search"
                type="search"
                placeholder="궁금한 육아·정책 이야기를 입력해 보세요"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Button
                type="submit"
                variant="outline"
                className="whitespace-normal min-[360px]:shrink-0"
              >
                <Search aria-hidden="true" />
                검색
              </Button>
            </div>
            {submittedQuery && (
              <p
                className="text-muted-foreground mt-3 text-sm leading-relaxed break-words"
                role="status"
              >
                입력한 검색어: <strong>‘{submittedQuery}’</strong>. 검색할
                게시글은 아직 제공되지 않습니다.
              </p>
            )}
          </form>
          <EmptyState
            title="검색 가능한 게시글을 준비하고 있습니다"
            description="커뮤니티가 열리기 전, 우리 가족을 위한 지원 정책과 주변 시설을 먼저 살펴보세요."
            action={
              <Button asChild variant="outline">
                <Link href="/policy">
                  정책 둘러보기
                  <ArrowRight />
                </Link>
              </Button>
            }
          />
        </Card>
        <div className="text-muted-foreground mt-7 flex items-start gap-3 border-y py-5 text-base leading-relaxed">
          <ShieldCheck className="text-primary size-5 shrink-0" />
          <p>
            <strong className="text-foreground">
              함께 만드는 신뢰할 수 있는 공간
            </strong>
            <br />
            개인정보가 담긴 서류나 계좌정보는 공유하지 마세요. 지원 자격과 신청
            기준은 반드시 공식 기관에서 확인해 주세요.
          </p>
        </div>
        <Dialog
          open={writeOpen}
          onClose={() => setWriteOpen(false)}
          title="경험과 질문을 나눌 공간을 준비하고 있어요"
        >
          <p className="text-muted-foreground text-base leading-relaxed">
            게시글 저장과 회원 로그인이 아직 연결되지 않아 경험과 질문을 등록할
            수 없습니다. 지금은 정책 둘러보기에서 필요한 정보를 확인해 주세요.
          </p>
          <div className="mt-6 flex flex-col-reverse gap-2 min-[360px]:flex-row min-[360px]:justify-end">
            <Button variant="ghost" onClick={() => setWriteOpen(false)}>
              닫기
            </Button>
            <Button asChild>
              <Link href="/policy">정책 둘러보기</Link>
            </Button>
          </div>
        </Dialog>
      </main>
      <Footer />
    </>
  );
}
