# Elementary Assertions

## Segments
- Segment s1
  - SegmentText: "Prime factorization decomposes a positive integer into a set of prime numbers."
- Segment s2
  - SegmentText: "Each factor must be prime, and their product must equal the original number."
- Segment s3
  - SegmentText: "The process typically starts with the smallest prime factor and continues iteratively."
- Segment s4
  - SegmentText: "Prime factorization is commonly used in number theory and cryptography."

## Mentions
- Segment s1
  - 0-5 token Prime (head=Prime)
  - 0-19 chunk Prime factorization (head=Prime)
  - 0-19 mwe Prime factorization (head=factorization)
  - 6-19 token factorization (head=factorization)
  - 20-30 token decomposes (head=decomposes)
  - 20-60 chunk decomposes a positive integer into a set (head=decomposes)
  - 31-32 token a (head=a)
  - 33-41 token positive (head=positive)
  - 33-49 mwe positive integer (head=integer)
  - 42-49 token integer (head=integer)
  - 50-54 token into (head=into)
  - 55-56 token a (head=a)
  - 57-60 token set (head=set)
  - 57-77 mwe set of prime numbers (head=numbers)
  - 61-63 token of (head=of)
  - 61-77 chunk of prime numbers (head=of)
  - 64-69 token prime (head=prime)
  - 64-77 mwe prime numbers (head=numbers)
  - 70-77 token numbers (head=numbers)
  - 77-78 chunk . (head=.)
  - 77-78 token . (head=.)
- Segment s2
  - 79-83 token Each (head=Each)
  - 79-90 chunk (each) factor (head=factor)
  - 84-90 token factor (head=factor)
  - 91-95 chunk must (head=must)
  - 91-95 token must (head=must)
  - 96-98 chunk be (head=be)
  - 96-98 token be (head=be)
  - 99-104 chunk prime (head=prime)
  - 99-104 token prime (head=prime)
  - 104-105 chunk , (head=,)
  - 104-105 token , (head=,)
  - 106-109 chunk and (head=and)
  - 106-109 token and (head=and)
  - 110-115 token their (head=their)
  - 110-123 chunk their product (head=product)
  - 116-123 token product (head=product)
  - 124-128 token must (head=must)
  - 124-154 chunk must equal the original number (head=equal)
  - 129-134 token equal (head=equal)
  - 135-138 token the (head=the)
  - 139-147 token original (head=original)
  - 139-154 mwe original number (head=number)
  - 148-154 token number (head=number)
  - 154-155 chunk . (head=.)
  - 154-155 token . (head=.)
- Segment s3
  - 156-159 token The (head=The)
  - 156-167 chunk (the) process (head=process)
  - 160-167 token process (head=process)
  - 168-177 chunk typically (head=typically)
  - 168-177 token typically (head=typically)
  - 178-184 token starts (head=starts)
  - 178-215 chunk starts with the smallest prime factor (head=starts)
  - 185-189 token with (head=with)
  - 190-193 token the (head=the)
  - 194-202 token smallest (head=smallest)
  - 203-208 token prime (head=prime)
  - 203-215 mwe prime factor (head=factor)
  - 209-215 token factor (head=factor)
  - 216-219 chunk and (head=and)
  - 216-219 token and (head=and)
  - 220-229 token continues (head=continues)
  - 220-241 chunk continues iteratively (head=continues)
  - 220-241 mwe continues iteratively (head=iteratively)
  - 230-241 token iteratively (head=iteratively)
  - 241-242 chunk . (head=.)
  - 241-242 token . (head=.)
- Segment s4
  - 243-248 token Prime (head=Prime)
  - 243-262 chunk Prime factorization (head=factorization)
  - 243-262 mwe Prime factorization (head=factorization)
  - 249-262 token factorization (head=factorization)
  - 263-265 chunk is (head=is)
  - 263-265 token is (head=is)
  - 266-274 chunk commonly (head=commonly)
  - 266-274 token commonly (head=commonly)
  - 275-279 chunk used (head=used)
  - 275-279 token used (head=used)
  - 280-282 token in (head=in)
  - 280-296 chunk in number theory (head=in)
  - 283-289 token number (head=number)
  - 283-296 mwe number theory (head=theory)
  - 290-296 token theory (head=theory)
  - 297-300 chunk and (head=and)
  - 297-300 token and (head=and)
  - 301-313 chunk cryptography (head=cryptography)
  - 301-313 token cryptography (head=cryptography)
  - 313-314 chunk . (head=.)
  - 313-314 token . (head=.)

## Assertions

### Definitions
- Actor | Predicate | Theme | Attr | Location | wiki⁺
- (each) factor | be | - | prime | - | -
  - evidence: actor(r=0,t=2); attribute(r=0,t=1); operators(r=0,t=0)

### Coordinated Actions
- Actor | Predicate | Theme | Attr | Location | wiki⁺
- - | factor | - | - | - | -
  - evidence: operators(r=0,t=0)
- (the) process | starts | prime factor | - | - | -
  - evidence: actor(r=0,t=2); modifier(r=0,t=2); theme(r=0,t=2); operators(r=0,t=0)
- (the) process | continues iteratively | - | - | - | -
  - evidence: actor(r=0,t=2); operators(r=0,t=0)

### Actions
- Actor | Predicate | Theme | Attr | Location | wiki⁺
- Prime factorization | decomposes | positive integer | - | set of prime numbers | -
  - evidence: actor(r=0,t=2); location(r=0,t=4); theme(r=0,t=2); operators(r=0,t=0)
- their product | equal | original number | - | - | -
  - evidence: actor(r=0,t=2); theme(r=0,t=2); operators(r=0,t=0)
- - | used | Prime factorization | - | in number theory | -
  - evidence: location(r=0,t=3); modifier(r=0,t=1); theme(r=0,t=2); operators(r=0,t=0)

## Coverage
- primary_mention_ids count: 23
- covered_primary_mention_ids count: 18
- uncovered_primary_mention_ids count: 5

### Strictly Uncovered Primary Mentions
- is (mention_id=m:s4:263-265:token, reason=missing_relation)

### Contained Uncovered Primary Mentions
- their (mention_id=m:s2:110-115:token, contained_in=[m:s2:110-123:chunk], reason=missing_relation)
- product (mention_id=m:s2:116-123:token, contained_in=[m:s2:110-123:chunk], reason=missing_relation)
- process (mention_id=m:s3:160-167:token, contained_in=[m:s3:156-167:chunk], reason=missing_relation)
- number theory (mention_id=m:s4:283-296:mwe, contained_in=[m:s4:280-296:chunk], reason=operator_scope_open)

### Unresolved
- unresolved_attachment / missing_relation
  - their reason=missing_relation
  - product reason=missing_relation
  - process reason=missing_relation
  - is reason=missing_relation
- unresolved_attachment / operator_scope_open
  - number theory reason=operator_scope_open
