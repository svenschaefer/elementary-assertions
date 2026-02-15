# Elementary Assertions

## Segments
- Segment s1
  - SegmentText: "A prime number generator produces prime numbers in ascending order."
- Segment s2
  - SegmentText: "It starts at a given minimum value and tests each successive integer for primality."
- Segment s3
  - SegmentText: "The generator must ensure that only numbers greater than 1 are considered."
- Segment s4
  - SegmentText: "Generated primes may be used for educational purposes or basic numerical experiments."

## Mentions
- Segment s1
  - 0-1 token A (head=A)
  - 0-24 chunk (a) prime number generator (head=number)
  - 2-7 token prime (head=prime)
  - 2-14 mwe prime number (head=number)
  - 2-24 mwe prime number generator (head=generator)
  - 8-14 token number (head=number)
  - 8-24 mwe number generator (head=generator)
  - 15-24 token generator (head=generator)
  - 25-33 token produces (head=produces)
  - 25-47 chunk produces prime numbers (head=produces)
  - 34-39 token prime (head=prime)
  - 34-47 mwe prime numbers (head=numbers)
  - 40-47 token numbers (head=numbers)
  - 48-50 token in (head=in)
  - 48-66 chunk in ascending order (head=in)
  - 51-60 token ascending (head=ascending)
  - 51-66 mwe ascending order (head=order)
  - 61-66 token order (head=order)
  - 66-67 chunk . (head=.)
  - 66-67 token . (head=.)
- Segment s2
  - 68-70 chunk It (head=It)
  - 68-70 token It (head=It)
  - 71-77 chunk starts (head=starts)
  - 71-77 token starts (head=starts)
  - 78-80 token at (head=at)
  - 78-102 chunk at a given minimum value (head=at)
  - 81-82 token a (head=a)
  - 83-88 token given (head=given)
  - 89-96 token minimum (head=minimum)
  - 89-102 mwe minimum value (head=value)
  - 97-102 token value (head=value)
  - 103-106 chunk and (head=and)
  - 103-106 token and (head=and)
  - 107-112 token tests (head=tests)
  - 107-136 chunk tests each successive integer (head=tests)
  - 107-150 mwe tests each successive integer for primality (head=primality)
  - 113-117 token each (head=each)
  - 118-128 token successive (head=successive)
  - 118-136 mwe successive integer (head=integer)
  - 118-150 mwe successive integer for primality (head=primality)
  - 129-136 token integer (head=integer)
  - 137-140 token for (head=for)
  - 137-150 chunk for primality (head=for)
  - 141-150 token primality (head=primality)
  - 150-151 chunk . (head=.)
  - 150-151 token . (head=.)
- Segment s3
  - 152-155 token The (head=The)
  - 152-165 chunk (the) generator (head=generator)
  - 156-165 token generator (head=generator)
  - 166-170 token must (head=must)
  - 166-195 chunk must ensure that only numbers (head=ensure)
  - 171-177 token ensure (head=ensure)
  - 178-182 token that (head=that)
  - 183-187 token only (head=only)
  - 183-195 mwe only numbers (head=numbers)
  - 188-195 token numbers (head=numbers)
  - 196-203 chunk greater (head=greater)
  - 196-203 token greater (head=greater)
  - 204-208 chunk than (head=than)
  - 204-208 token than (head=than)
  - 209-210 chunk 1 (head=1)
  - 209-210 token 1 (head=1)
  - 211-214 token are (head=are)
  - 211-225 chunk are considered (head=considered)
  - 215-225 token considered (head=considered)
  - 225-226 chunk . (head=.)
  - 225-226 token . (head=.)
- Segment s4
  - 227-236 token Generated (head=Generated)
  - 227-243 chunk Generated primes (head=Generated)
  - 227-243 mwe Generated primes (head=primes)
  - 237-243 token primes (head=primes)
  - 244-247 token may (head=may)
  - 244-255 chunk may be used (head=used)
  - 248-250 token be (head=be)
  - 251-255 token used (head=used)
  - 256-259 token for (head=for)
  - 256-280 chunk for educational purposes (head=for)
  - 260-271 token educational (head=educational)
  - 260-280 mwe educational purposes (head=purposes)
  - 272-280 token purposes (head=purposes)
  - 281-283 chunk or (head=or)
  - 281-283 token or (head=or)
  - 284-289 token basic (head=basic)
  - 284-311 chunk basic numerical experiments (head=experiments)
  - 290-299 token numerical (head=numerical)
  - 290-311 mwe numerical experiments (head=experiments)
  - 300-311 token experiments (head=experiments)
  - 311-312 chunk . (head=.)
  - 311-312 token . (head=.)

## Assertions

### Coordinated Actions
- Actor | Predicate | Theme | Attr | Location | wiki⁺
- - | tests each successive integer for primality | successive integer for primality | - | - | -
  - evidence: theme(r=0,t=4); operators(r=0,t=0)

### Actions
- Actor | Predicate | Theme | Attr | Location | wiki⁺
- (a) prime number generator | produces | prime numbers | - | ascending order | -
  - evidence: actor(r=0,t=4); location(r=0,t=2); theme(r=0,t=2); operators(r=0,t=0)
- It | starts | - | - | at a given minimum value | -
  - evidence: actor(r=0,t=1); attached_theme(r=0,t=2); location(r=0,t=5); operators(r=0,t=0)
- (the) generator | ensure | only numbers | - | - | -
  - evidence: actor(r=0,t=2); modifier(r=0,t=1); theme(r=0,t=2); operators(r=0,t=0)
- (the) generator | considered | - | - | - | -
  - evidence: actor(r=0,t=2); operators(r=0,t=0)
- - | used | basic numerical experiments | - | - | -
  - evidence: beneficiary(r=0,t=3); theme(r=0,t=3); operators(r=0,t=0)

## Coverage
- primary_mention_ids count: 22
- covered_primary_mention_ids count: 15
- uncovered_primary_mention_ids count: 7

### Strictly Uncovered Primary Mentions
- are (mention_id=m:s3:211-214:token, reason=missing_relation)
- be (mention_id=m:s4:248-250:token, reason=missing_relation)

### Contained Uncovered Primary Mentions
- prime number generator (mention_id=m:s1:2-24:mwe, contained_in=[m:s1:0-24:chunk], reason=missing_relation)
- generator (mention_id=m:s3:156-165:token, contained_in=[m:s3:152-165:chunk], reason=missing_relation)
- educational purposes (mention_id=m:s4:260-280:mwe, contained_in=[m:s4:256-280:chunk], reason=missing_relation)
- basic (mention_id=m:s4:284-289:token, contained_in=[m:s4:284-311:chunk], reason=missing_relation)
- numerical experiments (mention_id=m:s4:290-311:mwe, contained_in=[m:s4:284-311:chunk], reason=missing_relation)

### Unresolved
- unresolved_attachment / missing_relation
  - prime number generator reason=missing_relation
  - generator reason=missing_relation
  - are reason=missing_relation
  - be reason=missing_relation
  - educational purposes reason=missing_relation
  - basic reason=missing_relation
  - numerical experiments reason=missing_relation
