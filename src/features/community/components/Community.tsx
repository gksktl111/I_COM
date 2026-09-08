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
      <main id="main-content" className="page-container py-10 sm:py-12">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <span className="text-primary mb-3 inline-flex items-center gap-2 text-xs font-semibold">
              <MessageCircle className="size-4" />
              아이콤 정책 사랑방
            </span>
            <h1 className="text-[1.75rem] font-bold">
              육아·정책 소통 커뮤니티
            </h1>
            <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-6">
              신청 경험과 서류 준비 노하우, 우리 동네의 육아 이야기를 함께 나눌
              공간입니다.
            </p>
          </div>
          <Button onClick={() => setWriteOpen(true)}>
            <PenLine />
            경험·질문 작성하기
          </Button>
        </div>
        <div className="mb-6 flex flex-wrap gap-2" aria-label="게시글 분류">
          {categories.map((item) => (
            <Chip
              key={item}
              selected={category === item}
              onClick={() => setCategory(item)}
            >
              {item}
            </Chip>
          ))}
        </div>
        <Notice className="mb-7">
          <strong className="text-foreground mr-2">
            커뮤니티 오픈 준비 중
          </strong>
          부모님들의 경험을 안전하게 나눌 수 있도록 게시글과 댓글 기능을
          준비하고 있습니다.
        </Notice>
        <Card className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <h2 className="font-semibold">
              {category}{" "}
              <span className="text-muted-foreground ml-1 font-normal">
                0건
              </span>
            </h2>
            <span className="text-muted-foreground text-xs">
              등록된 게시글이 없습니다
            </span>
          </div>
          <EmptyState
            title={
              submittedQuery
                ? `‘${submittedQuery}’ 검색 결과가 없습니다`
                : "아직 나눔 글이 없습니다"
            }
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
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSubmittedQuery(query.trim());
            }}
            className="mx-auto flex max-w-xl gap-2 px-5 pb-6"
          >
            <Input
              aria-label="커뮤니티 검색"
              placeholder="궁금한 육아·정책 이야기를 검색해 보세요"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Button type="submit" aria-label="게시글 검색">
              <Search />
              <span className="hidden sm:inline">검색</span>
            </Button>
          </form>
        </Card>
        <div className="text-muted-foreground mt-7 flex items-start gap-3 border-y py-5 text-sm">
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
          <p className="text-muted-foreground text-sm leading-7">
            게시글 작성과 회원 로그인이 연결되면 경험과 질문을 등록할 수
            있습니다. 지금은 정책 둘러보기에서 필요한 정보를 확인해 주세요.
          </p>
          <div className="mt-6 flex justify-end gap-2">
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
