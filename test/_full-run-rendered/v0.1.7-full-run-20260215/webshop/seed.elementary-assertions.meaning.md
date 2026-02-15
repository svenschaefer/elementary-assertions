# Elementary Assertions

## Segments
- Segment s1
  - SegmentText: "A WebShop is an online store where people can pick products they want to buy, put them into a shopping cart, and then complete the purchase by placing an order."
- Segment s2
  - SegmentText: "While doing that, the shop needs to make sure the items are actually available, take the customer’s payment, and keep a reliable record of the order."

## Mentions
- Segment s1
  - 0-1 token A (head=A)
  - 0-9 chunk (a) WebShop (head=WebShop)
  - 2-9 token WebShop (head=WebShop)
  - 10-12 chunk is (head=is)
  - 10-12 token is (head=is)
  - 13-15 token an (head=an)
  - 13-28 chunk (an) online store (head=store)
  - 16-22 token online (head=online)
  - 16-28 mwe online store (head=store)
  - 23-28 token store (head=store)
  - 29-34 chunk where (head=where)
  - 29-34 token where (head=where)
  - 35-41 chunk people (head=people)
  - 35-41 token people (head=people)
  - 42-45 token can (head=can)
  - 42-59 chunk can pick products (head=pick)
  - 46-50 token pick (head=pick)
  - 46-59 mwe pick products (head=products)
  - 51-59 token products (head=products)
  - 60-64 chunk they (head=they)
  - 60-64 token they (head=they)
  - 65-69 token want (head=want)
  - 65-76 chunk want to buy (head=want)
  - 65-76 mwe want to buy (head=buy)
  - 70-72 token to (head=to)
  - 73-76 token buy (head=buy)
  - 76-77 chunk , (head=,)
  - 76-77 token , (head=,)
  - 78-81 chunk put (head=put)
  - 78-81 token put (head=put)
  - 82-86 chunk them (head=them)
  - 82-86 token them (head=them)
  - 87-91 token into (head=into)
  - 87-107 chunk into a shopping cart (head=into)
  - 92-93 token a (head=a)
  - 94-102 token shopping (head=shopping)
  - 94-107 mwe shopping cart (head=cart)
  - 103-107 token cart (head=cart)
  - 107-108 chunk , (head=,)
  - 107-108 token , (head=,)
  - 109-112 chunk and (head=and)
  - 109-112 token and (head=and)
  - 113-117 chunk then (head=then)
  - 113-117 token then (head=then)
  - 118-126 chunk complete (head=complete)
  - 118-126 token complete (head=complete)
  - 127-130 token the (head=the)
  - 127-139 chunk (the) purchase (head=purchase)
  - 131-139 token purchase (head=purchase)
  - 140-142 chunk by (head=by)
  - 140-142 token by (head=by)
  - 143-150 token placing (head=placing)
  - 143-159 chunk placing an order (head=placing)
  - 143-159 mwe placing an order (head=order)
  - 151-153 token an (head=an)
  - 154-159 token order (head=order)
  - 159-160 chunk . (head=.)
  - 159-160 token . (head=.)
- Segment s2
  - 162-167 chunk While (head=While)
  - 162-167 token While (head=While)
  - 168-173 chunk doing (head=doing)
  - 168-173 token doing (head=doing)
  - 174-178 chunk that (head=that)
  - 174-178 token that (head=that)
  - 178-179 chunk , (head=,)
  - 178-179 token , (head=,)
  - 180-183 token the (head=the)
  - 180-188 chunk (the) shop (head=shop)
  - 184-188 token shop (head=shop)
  - 189-194 token needs (head=needs)
  - 189-202 chunk needs to make (head=needs)
  - 195-197 token to (head=to)
  - 198-202 token make (head=make)
  - 203-207 chunk sure (head=sure)
  - 203-207 token sure (head=sure)
  - 208-211 token the (head=the)
  - 208-217 chunk (the) items (head=items)
  - 212-217 token items (head=items)
  - 218-221 chunk are (head=are)
  - 218-221 token are (head=are)
  - 222-230 chunk actually (head=actually)
  - 222-230 token actually (head=actually)
  - 231-240 chunk available (head=available)
  - 231-240 token available (head=available)
  - 240-241 chunk , (head=,)
  - 240-241 token , (head=,)
  - 242-246 token take (head=take)
  - 242-259 chunk take the customer (head=take)
  - 242-259 mwe take the customer (head=customer)
  - 247-250 token the (head=the)
  - 251-259 token customer (head=customer)
  - 251-269 mwe customer’s payment (head=payment)
  - 259-261 chunk ’s (head=’s)
  - 259-261 token ’s (head=’s)
  - 262-269 chunk payment (head=payment)
  - 262-269 token payment (head=payment)
  - 269-270 chunk , (head=,)
  - 269-270 token , (head=,)
  - 271-274 chunk and (head=and)
  - 271-274 token and (head=and)
  - 275-279 token keep (head=keep)
  - 275-310 chunk keep a reliable record of the order (head=keep)
  - 280-281 token a (head=a)
  - 282-290 token reliable (head=reliable)
  - 282-297 mwe reliable record (head=record)
  - 291-297 token record (head=record)
  - 291-310 mwe record of the order (head=order)
  - 298-300 token of (head=of)
  - 301-304 token the (head=the)
  - 305-310 token order (head=order)
  - 310-311 chunk . (head=.)
  - 310-311 token . (head=.)

## Assertions

### Definitions
- Actor | Predicate | Theme | Attr | Location | wiki⁺
- (a) WebShop | (copula:is) | - | (an) online store | - | -
  - evidence: actor(r=0,t=2); attribute(r=0,t=3); operators(r=0,t=0)
- (the) shop | needs | (the) items | available | - | -
  - evidence: actor(r=0,t=2); attribute(r=0,t=1); complement_clause(r=0,t=1); modifier(r=0,t=1); theme(r=0,t=2); operators(r=0,t=0)

### Capabilities
- Actor | Predicate | Theme | Attr | Location | wiki⁺
- people | can pick products | they | - | - | -
  - evidence: actor(r=0,t=1); theme(r=0,t=1); operators(r=0,t=0)

### Coordinated Actions
- Actor | Predicate | Theme | Attr | Location | wiki⁺
- people | want to buy | them | - | shopping cart | -
  - evidence: actor(r=0,t=1); location(r=0,t=2); theme(r=0,t=1); operators(r=0,t=0)
- - | put | them | - | into a shopping cart | -
  - evidence: location(r=0,t=4); modifier(r=0,t=1); theme(r=0,t=1); operators(r=0,t=0)
- - | (copula:are) | - | available | - | -
  - evidence: attribute(r=0,t=1); operators(r=0,t=0)
- - | take | customer’s payment | - | - | -
  - evidence: theme(r=0,t=3); operators(r=0,t=0)
- - | keep | record of the order | - | - | -
  - evidence: theme(r=0,t=4); operators(r=0,t=0)

### Actions
- Actor | Predicate | Theme | Attr | Location | wiki⁺
- - | complete | purchase | - | - | -
  - evidence: theme(r=0,t=1); operators(r=0,t=0)
- (the) purchase | placing an order | - | - | - | -
  - evidence: actor(r=0,t=2); operators(r=0,t=0)

## Coverage
- primary_mention_ids count: 28
- covered_primary_mention_ids count: 21
- uncovered_primary_mention_ids count: 7

### Strictly Uncovered Primary Mentions
- doing (mention_id=m:s2:168-173:token, reason=projection_failed)
- reliable (mention_id=m:s2:282-290:token, reason=missing_relation)

### Contained Uncovered Primary Mentions
- WebShop (mention_id=m:s1:2-9:token, contained_in=[m:s1:0-9:chunk], reason=missing_relation)
- online store (mention_id=m:s1:16-28:mwe, contained_in=[m:s1:13-28:chunk], reason=missing_relation)
- pick products (mention_id=m:s1:46-59:mwe, contained_in=[m:s1:42-59:chunk], reason=projection_failed)
- shop (mention_id=m:s2:184-188:token, contained_in=[m:s2:180-188:chunk], reason=missing_relation)
- items (mention_id=m:s2:212-217:token, contained_in=[m:s2:208-217:chunk], reason=missing_relation)

### Unresolved
- unresolved_attachment / missing_relation
  - online store reason=missing_relation
  - WebShop reason=missing_relation
  - shop reason=missing_relation
  - items reason=missing_relation
  - reliable reason=missing_relation
- unresolved_attachment / projection_failed
  - pick products reason=projection_failed
  - doing reason=projection_failed
