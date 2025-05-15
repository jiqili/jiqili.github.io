import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';
type FeatureItem = {
  title: string;
  imgURL: string
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Experience',
    imgURL: require('@site/static/img/me.jpeg').default,
    description: (
      <>
        In 2023, I graduated from the University of Donghua with a bachelor's and master's degree in Software Engineering. Then I worked at Intel. I like to play games and all kinkds of sports.
      </>
    ),
  },
  {
    title: 'Web Development',
    imgURL: require('@site/static/img/web-dev.png').default,
    description: (
      <>
        Focused on web development, I have experience in React, Vue, and Node.js. I am also familiar with Python and Java. In fact, I am a full-stack developer. My projects are involved in 3D rendering, so I also pay attention to web performance.
      </>
    ),
  },
  {
    title: 'AI Development',
    imgURL: require('@site/static/img/ai-dev.png').default,
    description: (
      <>
        I like to explore the field of AI, and I did some innovative projects involved in AI. I applied AI to my software projects, and did some finetuning on AI models, such as keywords spotting.
      </>
    ),
  },
];

function Feature({title, imgURL, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <img src={imgURL} className={styles.featureSvg} />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
